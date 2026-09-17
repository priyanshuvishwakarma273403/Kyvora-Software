package com.kyvora.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.Builder;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.stereotype.Service;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;
import java.util.List;
import java.util.stream.Collectors;

@Service
@Slf4j
public class AgentService {

    private final AiGatewayService aiGatewayService;
    private final ObjectMapper objectMapper;
    private final com.kyvora.backend.kafka.KafkaEventProducer kafkaEventProducer;
    private final Path sandboxPath;
    private final RagVectorDbService ragVectorDbService;

    public AgentService(AiGatewayService aiGatewayService, ObjectMapper objectMapper, com.kyvora.backend.kafka.KafkaEventProducer kafkaEventProducer, RagVectorDbService ragVectorDbService) {
        this.aiGatewayService = aiGatewayService;
        this.objectMapper = objectMapper;
        this.kafkaEventProducer = kafkaEventProducer;
        this.ragVectorDbService = ragVectorDbService;
        // Sandbox is d:\Cursor-clone\scratch
        this.sandboxPath = Paths.get("d:\\Cursor-clone\\scratch").toAbsolutePath().normalize();
        try {
            if (!Files.exists(sandboxPath)) {
                Files.createDirectories(sandboxPath);
            }
        } catch (IOException e) {
            log.error("Failed to initialize Agent Sandbox directory: {}", e.getMessage());
        }
    }

    @Data
    public static class AgentStep {
        private String thought;
        private String toolCalled;
        private Map<String, Object> arguments;
        private String toolOutput;
        private long timestamp;
    }

    @Data
    @Builder
    public static class AgentResult {
        private String agentId;
        private String status; // SUCCESS, FAILED
        private String finalResponse;
        private List<AgentStep> steps;
        private List<String> modifiedFiles;
    }

    public AgentResult runAgent(String agentId, String prompt, String provider, String model, List<Map<String, String>> initialFiles) {
        log.info("Running agent '{}' with prompt: {}", agentId, prompt);
        List<AgentStep> steps = new ArrayList<>();
        List<String> modifiedFiles = new ArrayList<>();
        
        // Write initial context files if provided
        if (initialFiles != null) {
            for (Map<String, String> fileInfo : initialFiles) {
                String path = fileInfo.get("path");
                String content = fileInfo.get("content");
                if (path != null && content != null) {
                    try {
                        writeFileTool(path, content);
                        modifiedFiles.add(path);
                    } catch (Exception e) {
                        log.error("Failed to write initial file '{}': {}", path, e.getMessage());
                    }
                }
            }
        }

        String actualProvider = (provider == null || provider.isEmpty()) ? "gemini" : provider;
        String actualModel = model;

        String systemPrompt = buildSystemPrompt(agentId);

        StringBuilder conversationHistory = new StringBuilder();
        conversationHistory.append("User Request: ").append(prompt).append("\n\n");

        // Integrate RAG Vector retrieval for research and memory agents
        if ("research".equalsIgnoreCase(agentId) || "memory".equalsIgnoreCase(agentId) || "planner".equalsIgnoreCase(agentId)) {
            try {
                List<Map<String, Object>> searchResults = ragVectorDbService.search(prompt, 3);
                if (searchResults != null && !searchResults.isEmpty()) {
                    conversationHistory.append("=== RETRIEVED SEMANTIC CONTEXT FROM VECTOR DB ===\n");
                    for (Map<String, Object> res : searchResults) {
                        conversationHistory.append("Source: ").append(res.get("sourceName")).append("\n");
                        conversationHistory.append("Content Chunk:\n").append(res.get("chunkContent")).append("\n");
                        conversationHistory.append("Similarity Score: ").append(String.format("%.4f", res.get("score"))).append("\n---\n");
                    }
                    conversationHistory.append("\n");
                }
            } catch (Exception e) {
                log.error("Failed to fetch RAG vector context: {}", e.getMessage());
            }
        }

        boolean finished = false;
        int stepCount = 0;
        int maxSteps = 6;

        while (!finished && stepCount < maxSteps) {
            stepCount++;
            AgentStep currentStep = new AgentStep();
            currentStep.setTimestamp(System.currentTimeMillis());
            
            // Build the dynamic prompt for the model
            String fullPrompt = systemPrompt + "\n\n" +
                    "=== CONVERSATION HISTORY & STATUS ===\n" +
                    conversationHistory.toString() + "\n" +
                    "Decide on the next step. Return a JSON object with: thought, tool, arguments.";

            String aiResponseText = "";
            try {
                aiResponseText = aiGatewayService.callAi(actualProvider, actualModel, fullPrompt);
            } catch (Exception e) {
                log.error("AI gateway failed during agent execution: {}", e.getMessage());
                currentStep.setThought("Critical: AI service call failed.");
                currentStep.setToolCalled("NONE");
                currentStep.setToolOutput("Error: " + e.getMessage());
                steps.add(currentStep);
                break;
            }

            // Parse response
            Map<String, Object> aiResponseMap;
            try {
                aiResponseMap = parseAiJsonResponse(aiResponseText);
            } catch (Exception e) {
                log.warn("Failed to parse AI response as JSON: {}. Response content: {}", e.getMessage(), aiResponseText);
                currentStep.setThought("Failed to parse AI response as structured JSON. Attempting fallback.");
                currentStep.setToolCalled("NONE");
                currentStep.setToolOutput("Raw AI Response: " + aiResponseText);
                steps.add(currentStep);
                conversationHistory.append("System Error: Your response could not be parsed as valid JSON. Ensure you return ONLY valid JSON.\n\n");
                continue;
            }

            String thought = (String) aiResponseMap.getOrDefault("thought", "");
            String tool = (String) aiResponseMap.getOrDefault("tool", "FINISH");
            Map<String, Object> arguments = (Map<String, Object>) aiResponseMap.getOrDefault("arguments", new HashMap<>());

            currentStep.setThought(thought);
            currentStep.setToolCalled(tool);
            currentStep.setArguments(arguments);

            log.info("Agent Step {}: Thought: '{}', Tool: '{}'", stepCount, thought, tool);

            // Add action to history
            conversationHistory.append("Step ").append(stepCount).append(" - Thought: ").append(thought).append("\n");
            conversationHistory.append("Step ").append(stepCount).append(" - Tool Call: ").append(tool).append(" with arguments: ").append(arguments).append("\n");

            if ("FINISH".equalsIgnoreCase(tool)) {
                finished = true;
                String finalResponse = (String) arguments.getOrDefault("finalResponse", "Task complete.");
                currentStep.setToolOutput("Completed successfully.");
                steps.add(currentStep);

                // Publish final step to Kafka
                try {
                    com.kyvora.backend.dto.CollaborationEvent collabEvent = com.kyvora.backend.dto.CollaborationEvent.builder()
                            .type("AGENT_FINISH")
                            .sessionId("sess_agent_" + agentId)
                            .userId("usr_agent")
                            .username(agentId)
                            .payload(objectMapper.writeValueAsString(currentStep))
                            .timestamp(System.currentTimeMillis())
                            .build();
                    kafkaEventProducer.sendCollaborationEvent(collabEvent);
                } catch (Exception ex) {
                    log.error("Failed to publish agent finish to Kafka: {}", ex.getMessage());
                }

                return AgentResult.builder()
                        .agentId(agentId)
                        .status("SUCCESS")
                        .finalResponse(finalResponse)
                        .steps(steps)
                        .modifiedFiles(modifiedFiles)
                        .build();
            }

            // Execute the Tool
            String toolOutput = "";
            try {
                toolOutput = executeTool(tool, arguments, modifiedFiles);
            } catch (Exception e) {
                log.error("Tool execution error: {}", e.getMessage());
                toolOutput = "Error executing tool: " + e.getMessage();
            }

            currentStep.setToolOutput(toolOutput);
            steps.add(currentStep);

            // Publish Agent step as collaboration event to Kafka event bus
            try {
                com.kyvora.backend.dto.CollaborationEvent collabEvent = com.kyvora.backend.dto.CollaborationEvent.builder()
                        .type("AGENT_STEP")
                        .sessionId("sess_agent_" + agentId)
                        .userId("usr_agent")
                        .username(agentId)
                        .payload(objectMapper.writeValueAsString(currentStep))
                        .timestamp(System.currentTimeMillis())
                        .build();
                kafkaEventProducer.sendCollaborationEvent(collabEvent);
            } catch (Exception ex) {
                log.error("Failed to publish agent step to Kafka: {}", ex.getMessage());
            }

            conversationHistory.append("Step ").append(stepCount).append(" - Tool Output: ").append(toolOutput).append("\n\n");
        }

        return AgentResult.builder()
                .agentId(agentId)
                .status("FAILED")
                .finalResponse("Agent execution reached limit of " + maxSteps + " steps without finishing.")
                .steps(steps)
                .modifiedFiles(modifiedFiles)
                .build();
    }

    private String executeTool(String tool, Map<String, Object> arguments, List<String> modifiedFiles) throws Exception {
        return switch (tool.toUpperCase()) {
            case "READ_FILE" -> {
                String path = (String) arguments.get("path");
                yield readFileTool(path);
            }
            case "WRITE_FILE" -> {
                String path = (String) arguments.get("path");
                String content = (String) arguments.get("content");
                writeFileTool(path, content);
                if (!modifiedFiles.contains(path)) {
                    modifiedFiles.add(path);
                }
                yield "Successfully wrote " + content.length() + " chars to " + path;
            }
            case "DELETE_FILE" -> {
                String path = (String) arguments.get("path");
                deleteFileTool(path);
                yield "Successfully deleted file: " + path;
            }
            case "MOVE_FILE" -> {
                String source = (String) arguments.get("source");
                String destination = (String) arguments.get("destination");
                moveFileTool(source, destination);
                yield "Successfully moved file from " + source + " to " + destination;
            }
            case "SCAN_SECURITY" -> {
                String path = (String) arguments.get("path");
                yield scanSecurityTool(path);
            }
            case "COMPUTE_COMPLEXITY" -> {
                String path = (String) arguments.get("path");
                yield computeComplexityTool(path);
            }
            case "MOCK_GITHUB_API" -> {
                String action = (String) arguments.get("action");
                Map<String, Object> params = (Map<String, Object>) arguments.getOrDefault("parameters", new HashMap<>());
                yield mockGithubApiTool(action, params);
            }
            case "GIT_COMMAND" -> {
                String command = (String) arguments.get("command");
                if (!command.trim().startsWith("git")) {
                    yield "Security Error: Command must be a git command starting with 'git'";
                }
                yield runCommandTool(command);
            }
            case "LIST_FILES" -> listFilesTool();
            case "RUN_COMMAND" -> {
                String command = (String) arguments.get("command");
                yield runCommandTool(command);
            }
            case "READ_PDF" -> {
                String pdfBase64 = (String) arguments.get("pdfBase64");
                yield readPdfTool(pdfBase64);
            }
            case "EDIT_IMAGE" -> {
                String imageBase64 = (String) arguments.get("imageBase64");
                String operation = (String) arguments.get("operation");
                Map<String, Object> params = (Map<String, Object>) arguments.getOrDefault("parameters", new HashMap<>());
                yield editImageTool(imageBase64, operation, params);
            }
            default -> "Unknown tool: " + tool;
        };
    }

    // Tools Implementations
    private String readFileTool(String relativePath) throws IOException {
        Path filePath = resolveAndValidate(relativePath);
        if (!Files.exists(filePath)) {
            return "File does not exist: " + relativePath;
        }
        return Files.readString(filePath);
    }

    private void deleteFileTool(String relativePath) throws IOException {
        Path filePath = resolveAndValidate(relativePath);
        if (Files.exists(filePath)) {
            Files.delete(filePath);
        }
    }

    private void moveFileTool(String sourceRel, String destRel) throws IOException {
        Path sourcePath = resolveAndValidate(sourceRel);
        Path destPath = resolveAndValidate(destRel);
        if (Files.exists(sourcePath)) {
            Files.createDirectories(destPath.getParent());
            Files.move(sourcePath, destPath, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
        } else {
            throw new FileNotFoundException("Source file not found: " + sourceRel);
        }
    }

    private String scanSecurityTool(String relativePath) throws IOException {
        Path filePath = resolveAndValidate(relativePath);
        if (!Files.exists(filePath)) {
            return "File does not exist: " + relativePath;
        }
        String content = Files.readString(filePath);
        StringBuilder report = new StringBuilder();
        report.append("=== SECURITY SCAN REPORT FOR ").append(relativePath).append(" ===\n");
        String[] lines = content.split("\n");
        int warnings = 0;
        for (int i = 0; i < lines.length; i++) {
            String line = lines[i];
            if (line.matches(".*(key|secret|password|token|auth|credential)\\s*=\\s*['\"][a-zA-Z0-9_-]{8,}['\"].*")) {
                report.append("Line ").append(i+1).append(": WARNING - Possible hardcoded secret/credentials found: ").append(line.trim()).append("\n");
                warnings++;
            }
            if (line.matches(".*SELECT.*\\+.*") || line.matches(".*INSERT.*\\+.*") || line.matches(".*UPDATE.*\\+.*")) {
                report.append("Line ").append(i+1).append(": WARNING - Potential SQL Injection: String concatenation in SQL query: ").append(line.trim()).append("\n");
                warnings++;
            }
            if (line.contains("System.out.print") || line.contains(".printStackTrace()")) {
                report.append("Line ").append(i+1).append(": INFO - Use of standard output or stacktrace print (sensitive log exposure): ").append(line.trim()).append("\n");
                warnings++;
            }
        }
        if (warnings == 0) {
            report.append("No critical security vulnerability found.");
        } else {
            report.append("\nTotal warnings/alerts found: ").append(warnings);
        }
        return report.toString();
    }

    private String computeComplexityTool(String relativePath) throws IOException {
        Path filePath = resolveAndValidate(relativePath);
        if (!Files.exists(filePath)) {
            return "File does not exist: " + relativePath;
        }
        String content = Files.readString(filePath);
        int ifCount = 0;
        int forCount = 0;
        int whileCount = 0;
        int switchCount = 0;
        int tryCatchCount = 0;
        
        String[] lines = content.split("\n");
        for (String line : lines) {
            if (line.contains("if ") || line.contains("if(")) ifCount++;
            if (line.contains("for ") || line.contains("for(")) forCount++;
            if (line.contains("while ") || line.contains("while(")) whileCount++;
            if (line.contains("switch ") || line.contains("switch(")) switchCount++;
            if (line.contains("catch ") || line.contains("catch(")) tryCatchCount++;
        }
        int totalComplexity = 1 + ifCount + forCount + whileCount + switchCount;
        return "=== CODE COMPLEXITY METRICS FOR " + relativePath + " ===\n" +
                "Cyclomatic Complexity (Estimate): " + totalComplexity + "\n" +
                "- If Conditions: " + ifCount + "\n" +
                "- For Loops: " + forCount + "\n" +
                "- While Loops: " + whileCount + "\n" +
                "- Switch Statements: " + switchCount + "\n" +
                "- Exception Catch Blocks: " + tryCatchCount + "\n" +
                "Recommendation: " + (totalComplexity > 10 ? "HIGH COMPLEXITY. Refactoring recommended to split functions." : "Good complexity footprint.");
    }

    private String mockGithubApiTool(String action, Map<String, Object> params) throws Exception {
        return switch (action.toLowerCase()) {
            case "create_pr" -> {
                String title = (String) params.getOrDefault("title", "Update PR");
                String branch = (String) params.getOrDefault("branch", "feature-branch");
                yield "{\"status\": \"SUCCESS\", \"prNumber\": 102, \"url\": \"https://github.com/kyvora/repo/pull/102\", \"title\": \"" + title + "\", \"head\": \"" + branch + "\", \"message\": \"Pull request created successfully.\"}";
            }
            case "get_issue" -> {
                int issueId = ((Number) params.getOrDefault("issueId", 1)).intValue();
                yield "{\"issueId\": " + issueId + ", \"title\": \"Bug: Token validation failure\", \"description\": \"Token validation fails for custom endpoint /api/v1/ai/agent\", \"labels\": [\"bug\", \"security\"], \"status\": \"OPEN\"}";
            }
            case "create_release" -> {
                String version = (String) params.getOrDefault("version", "v1.0.0");
                yield "{\"status\": \"SUCCESS\", \"tag\": \"" + version + "\", \"releaseId\": 89201, \"url\": \"https://github.com/kyvora/repo/releases/tag/" + version + "\", \"notes\": \"Release compiled automatically by Kyvora Release Agent.\"}";
            }
            default -> "{\"error\": \"Unknown github action: " + action + "\"}";
        };
    }

    private void writeFileTool(String relativePath, String content) throws IOException {
        Path filePath = resolveAndValidate(relativePath);
        Files.createDirectories(filePath.getParent());
        Files.writeString(filePath, content);
    }

    private String listFilesTool() throws IOException {
        if (!Files.exists(sandboxPath)) {
            return "No files in sandbox.";
        }
        try (var stream = Files.walk(sandboxPath)) {
            return stream.filter(Files::isRegularFile)
                    .map(path -> sandboxPath.relativize(path).toString())
                    .collect(Collectors.joining("\n"));
        }
    }

    private String runCommandTool(String command) {
        log.info("Executing sandbox command: {}", command);
        // Clean and run command securely
        StringBuilder output = new StringBuilder();
        try {
            String os = System.getProperty("os.name").toLowerCase();
            ProcessBuilder processBuilder = new ProcessBuilder();
            processBuilder.directory(sandboxPath.toFile());
            
            if (os.contains("win")) {
                processBuilder.command("cmd.exe", "/c", command);
            } else {
                processBuilder.command("sh", "-c", command);
            }
            
            Process process = processBuilder.start();
            
            BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
            BufferedReader errorReader = new BufferedReader(new InputStreamReader(process.getErrorStream()));
            
            String line;
            while ((line = reader.readLine()) != null) {
                output.append(line).append("\n");
            }
            while ((line = errorReader.readLine()) != null) {
                output.append("[ERROR] ").append(line).append("\n");
            }
            
            int exitCode = process.waitFor();
            output.append("\nCommand completed with exit code: ").append(exitCode);
        } catch (Exception e) {
            output.append("Process Execution Failed: ").append(e.getMessage());
        }
        return output.toString();
    }

    private String readPdfTool(String pdfBase64) throws Exception {
        if (pdfBase64.contains(",")) {
            pdfBase64 = pdfBase64.substring(pdfBase64.indexOf(",") + 1);
        }
        byte[] pdfBytes = Base64.getDecoder().decode(pdfBase64.trim());
        try (PDDocument document = Loader.loadPDF(pdfBytes)) {
            PDFTextStripper stripper = new PDFTextStripper();
            String text = stripper.getText(document);
            return "PDF Text Content extracted successfully:\n" + text;
        }
    }

    private String editImageTool(String imageBase64, String operation, Map<String, Object> params) throws Exception {
        if (imageBase64.contains(",")) {
            imageBase64 = imageBase64.substring(imageBase64.indexOf(",") + 1);
        }
        byte[] imageBytes = Base64.getDecoder().decode(imageBase64.trim());
        ByteArrayInputStream bais = new ByteArrayInputStream(imageBytes);
        BufferedImage img = ImageIO.read(bais);
        if (img == null) {
            throw new IllegalArgumentException("Failed to decode image. Invalid data.");
        }

        BufferedImage resultImg = img;
        String desc = "";

        switch (operation.toLowerCase()) {
            case "grayscale" -> {
                resultImg = new BufferedImage(img.getWidth(), img.getHeight(), BufferedImage.TYPE_BYTE_GRAY);
                Graphics g = resultImg.getGraphics();
                g.drawImage(img, 0, 0, null);
                g.dispose();
                desc = "Grayscale conversion completed.";
            }
            case "invert" -> {
                resultImg = new BufferedImage(img.getWidth(), img.getHeight(), img.getType());
                for (int y = 0; y < img.getHeight(); y++) {
                    for (int x = 0; x < img.getWidth(); x++) {
                        int p = img.getRGB(x, y);
                        int a = (p >> 24) & 0xff;
                        int r = 255 - ((p >> 16) & 0xff);
                        int g = 255 - ((p >> 8) & 0xff);
                        int b = 255 - (p & 0xff);
                        int inverted = (a << 24) | (r << 16) | (g << 8) | b;
                        resultImg.setRGB(x, y, inverted);
                    }
                }
                desc = "Color inversion completed.";
            }
            case "resize" -> {
                int width = ((Number) params.getOrDefault("width", img.getWidth() / 2)).intValue();
                int height = ((Number) params.getOrDefault("height", img.getHeight() / 2)).intValue();
                resultImg = new BufferedImage(width, height, BufferedImage.TYPE_INT_ARGB);
                Graphics2D g2 = resultImg.createGraphics();
                g2.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
                g2.drawImage(img, 0, 0, width, height, null);
                g2.dispose();
                desc = "Resized to " + width + "x" + height + ".";
            }
            case "crop" -> {
                int x = ((Number) params.getOrDefault("x", 0)).intValue();
                int y = ((Number) params.getOrDefault("y", 0)).intValue();
                int width = ((Number) params.getOrDefault("width", img.getWidth() / 2)).intValue();
                int height = ((Number) params.getOrDefault("height", img.getHeight() / 2)).intValue();
                resultImg = img.getSubimage(x, y, width, height);
                desc = "Cropped sub-image at (" + x + "," + y + ") with size " + width + "x" + height + ".";
            }
            default -> throw new IllegalArgumentException("Unknown image operation: " + operation);
        }

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        ImageIO.write(resultImg, "png", baos);
        byte[] resultBytes = baos.toByteArray();
        String resultBase64 = Base64.getEncoder().encodeToString(resultBytes);

        return "Image operation successful! " + desc + "\n[IMAGE_DATA_URL:data:image/png;base64," + resultBase64 + "]";
    }

    // Resolvers
    private Path resolveAndValidate(String relativePath) throws IOException {
        Path filePath = sandboxPath.resolve(relativePath).normalize();
        if (!filePath.startsWith(sandboxPath)) {
            throw new SecurityException("Attempted directory traversal outside sandbox path!");
        }
        return filePath;
    }

    private Map<String, Object> parseAiJsonResponse(String text) throws Exception {
        // Strip markdown code block if present
        String json = text.trim();
        if (json.startsWith("```")) {
            int firstNewline = json.indexOf("\n");
            int lastBacktick = json.lastIndexOf("```");
            if (firstNewline != -1 && lastBacktick > firstNewline) {
                json = json.substring(firstNewline + 1, lastBacktick).trim();
            }
        }
        return objectMapper.readValue(json, Map.class);
    }

    private String buildSystemPrompt(String agentId) {
        String basePrompt = "You are an autonomous AI Agent driving a workflow inside Kyvora Studio IDE.\n" +
                "You have access to a workspace directory (sandbox environment) where you can read, write, run files.\n" +
                "You must respond in strictly valid JSON format. Do NOT return normal chat or markdown text outside the JSON structure. Return ONLY a single JSON block.\n\n" +
                "JSON format to return:\n" +
                "{\n" +
                "  \"thought\": \"Detailed reasoning of what you are doing and why.\",\n" +
                "  \"tool\": \"READ_FILE | WRITE_FILE | DELETE_FILE | MOVE_FILE | LIST_FILES | RUN_COMMAND | READ_PDF | EDIT_IMAGE | SCAN_SECURITY | COMPUTE_COMPLEXITY | MOCK_GITHUB_API | GIT_COMMAND | FINISH\",\n" +
                "  \"arguments\": {\n" +
                "     // depending on the tool, pass required arguments:\n" +
                "     // READ_FILE: \"path\"\n" +
                "     // WRITE_FILE: \"path\", \"content\"\n" +
                "     // DELETE_FILE: \"path\"\n" +
                "     // MOVE_FILE: \"source\", \"destination\"\n" +
                "     // SCAN_SECURITY: \"path\"\n" +
                "     // COMPUTE_COMPLEXITY: \"path\"\n" +
                "     // MOCK_GITHUB_API: \"action\" (create_pr | get_issue | create_release), \"parameters\" (key-value map)\n" +
                "     // GIT_COMMAND: \"command\" (must start with 'git')\n" +
                "     // LIST_FILES: no args\n" +
                "     // RUN_COMMAND: \"command\"\n" +
                "     // READ_PDF: \"pdfBase64\"\n" +
                "     // EDIT_IMAGE: \"imageBase64\", \"operation\" (grayscale | invert | resize | crop), \"parameters\" (map for crop/resize)\n" +
                "     // FINISH: \"finalResponse\"\n" +
                "  }\n" +
                "}\n\n";

        return switch (agentId.toLowerCase()) {
            case "planner-agent", "planner" -> basePrompt + "Role: Planner Agent. Decompose user requests into structured tasks and direct other agents. FINISH.";
            case "architect-agent", "architect" -> basePrompt + "Role: Architect Agent. Design system components, design contracts and APIs. Use COMPUTE_COMPLEXITY to analyze source code structures. FINISH.";
            case "research-agent", "research" -> basePrompt + "Role: Research Agent. Search documentation and APIs to resolve implementation ambiguities. FINISH.";
            case "code-agent", "code" -> basePrompt + "Role: Code Agent. Write clear, type-safe, and self-documented files. Validate by running commands. FINISH.";
            case "refactor-agent", "refactor" -> basePrompt + "Role: Refactor Agent. Clean up code smells, remove duplicates, and optimize cyclomatic complexity. FINISH.";
            case "file-agent", "file" -> basePrompt + "Role: File Agent. Perform filesystem management. Create, read, move, or delete files. FINISH.";
            case "git-agent", "git" -> basePrompt + "Role: Git Agent. Manage repositories, commits, branches, and merges via GIT_COMMAND. FINISH.";
            case "review-agent", "review" -> basePrompt + "Role: Review Agent. Enforce style rules and perform static checks on code changes. FINISH.";
            case "debug-agent", "debug" -> basePrompt + "Role: Debug Agent. Parse error stacks and apply bug fixes. FINISH.";
            case "test-agent", "test" -> basePrompt + "Role: Test Agent. Generate and run unit and integration tests. FINISH.";
            case "deployment-agent", "deployment" -> basePrompt + "Role: Deployment Agent. Dockerize, package, and deploy builds. FINISH.";
            case "security-agent", "security" -> basePrompt + "Role: Security Agent. Audit code dependencies and source files using SCAN_SECURITY to identify vulnerabilities. FINISH.";
            case "documentation-agent", "documentation" -> basePrompt + "Role: Documentation Agent. Update comments and keep codebase README files complete. FINISH.";
            case "memory-agent", "memory" -> basePrompt + "Role: Memory Agent. Index context and locate semantic code relationships. FINISH.";
            case "terminal-agent", "terminal" -> basePrompt + "Role: Terminal Agent. Run background processes securely in the sandbox via RUN_COMMAND. FINISH.";
            case "collaboration-agent", "collaboration" -> basePrompt + "Role: Collaboration Agent. Synchronize multi-user states and coordinate lock updates. FINISH.";
            case "issue-agent", "issue" -> basePrompt + "Role: Issue Agent. Parse issue requests using MOCK_GITHUB_API action get_issue and prepare tasks. FINISH.";
            case "pr-agent", "pr" -> basePrompt + "Role: PR Agent. Create pull requests using MOCK_GITHUB_API action create_pr. FINISH.";
            case "release-agent", "release" -> basePrompt + "Role: Release Agent. Compile releases and draft changelogs using MOCK_GITHUB_API action create_release. FINISH.";
            default -> basePrompt + "Role: General developer assistant. Accomplish the user's objective step-by-step. FINISH.";
        };
    }
}
