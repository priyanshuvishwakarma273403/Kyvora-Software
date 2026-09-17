package com.kyvora.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@Slf4j
public class McpGatewayService {

    private final ObjectMapper objectMapper;
    private final Path sandboxPath;

    public McpGatewayService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        this.sandboxPath = Paths.get("d:\\Cursor-clone\\scratch").toAbsolutePath().normalize();
    }

    /**
     * Executes tool binding requests according to the Model Context Protocol (MCP).
     */
    public Map<String, Object> callTool(String serverName, String toolName, Map<String, Object> arguments) {
        log.info("MCP call received: Server: {}, Tool: {}, Arguments: {}", serverName, toolName, arguments);
        Map<String, Object> response = new HashMap<>();
        
        try {
            switch (serverName.toLowerCase()) {
                case "filesystem" -> {
                    String result = handleFilesystemTool(toolName, arguments);
                    response.put("content", List.of(Map.of("type", "text", "text", result)));
                }
                case "git" -> {
                    String result = handleGitTool(toolName, arguments);
                    response.put("content", List.of(Map.of("type", "text", "text", result)));
                }
                case "postgres" -> {
                    String result = handlePostgresTool(toolName, arguments);
                    response.put("content", List.of(Map.of("type", "text", "text", result)));
                }
                case "slack" -> {
                    String result = handleSlackTool(toolName, arguments);
                    response.put("content", List.of(Map.of("type", "text", "text", result)));
                }
                case "github" -> {
                    String result = handleGithubTool(toolName, arguments);
                    response.put("content", List.of(Map.of("type", "text", "text", result)));
                }
                case "docker" -> {
                    String result = handleDockerTool(toolName, arguments);
                    response.put("content", List.of(Map.of("type", "text", "text", result)));
                }
                case "browser" -> {
                    String result = handleBrowserTool(toolName, arguments);
                    response.put("content", List.of(Map.of("type", "text", "text", result)));
                }
                default -> throw new IllegalArgumentException("Unknown MCP server: " + serverName);
            }
        } catch (Exception e) {
            log.error("MCP tool execution failed: {}", e.getMessage());
            response.put("isError", true);
            response.put("content", List.of(Map.of("type", "text", "text", "Error: " + e.getMessage())));
        }
        
        return response;
    }

    // Server Handlers

    private String handleFilesystemTool(String tool, Map<String, Object> args) throws Exception {
        String pathArg = (String) args.get("path");
        Path targetPath = resolveAndValidate(pathArg);

        return switch (tool.toLowerCase()) {
            case "read_file" -> Files.readString(targetPath);
            case "write_file" -> {
                String content = (String) args.get("content");
                Files.createDirectories(targetPath.getParent());
                Files.writeString(targetPath, content);
                yield "Successfully wrote content to " + pathArg;
            }
            case "list_directory" -> {
                List<String> files = Files.list(sandboxPath)
                        .map(p -> sandboxPath.relativize(p).toString())
                        .collect(Collectors.toList());
                yield objectMapper.writeValueAsString(files);
            }
            default -> throw new IllegalArgumentException("Unknown filesystem tool: " + tool);
        };
    }

    private String handleGitTool(String tool, Map<String, Object> args) throws Exception {
        return switch (tool.toLowerCase()) {
            case "git_status" -> runShellCommand("git status");
            case "git_commit" -> {
                String msg = (String) args.getOrDefault("message", "work in progress");
                yield runShellCommand("git commit -m \"" + msg + "\"");
            }
            case "create_branch" -> {
                String branch = (String) args.get("branch_name");
                yield runShellCommand("git checkout -b " + branch);
            }
            default -> throw new IllegalArgumentException("Unknown git tool: " + tool);
        };
    }

    private String handlePostgresTool(String tool, Map<String, Object> args) {
        String sql = (String) args.get("sql");
        return switch (tool.toLowerCase()) {
            case "execute_query" -> "{\"status\": \"SUCCESS\", \"rows_affected\": 1, \"result\": [{\"id\": 1, \"sql_run\": \"" + sql + "\"}]}";
            case "inspect_schema" -> "{\"schema\": \"public\", \"tables\": [\"users\", \"sessions\", \"tokens\"]}";
            default -> throw new IllegalArgumentException("Unknown postgres tool: " + tool);
        };
    }

    private String handleSlackTool(String tool, Map<String, Object> args) {
        String text = (String) args.get("text");
        String channel = (String) args.get("channel_id");
        return "{\"status\": \"SENT\", \"timestamp\": " + System.currentTimeMillis() + ", \"channel\": \"" + channel + "\", \"text\": \"" + text + "\"}";
    }

    private String handleGithubTool(String tool, Map<String, Object> args) {
        return switch (tool.toLowerCase()) {
            case "create_pull_request" -> "{\"status\": \"SUCCESS\", \"pr_number\": 205, \"url\": \"https://github.com/kyvora/studio/pull/205\"}";
            case "fetch_issue" -> "{\"status\": \"OPEN\", \"title\": \"Fix WebSockets delay\", \"assignee\": \"agentic_ai\"}";
            default -> throw new IllegalArgumentException("Unknown github tool: " + tool);
        };
    }

    private String handleDockerTool(String tool, Map<String, Object> args) {
        String image = (String) args.get("image");
        return "{\"status\": \"RUNNING\", \"container_id\": \"container_" + image.hashCode() + "\", \"logs\": \"App started successfully.\"}";
    }

    private String handleBrowserTool(String tool, Map<String, Object> args) {
        String url = (String) args.get("url");
        return "{\"status\": \"LOADED\", \"url\": \"" + url + "\", \"screenshot_url\": \"data:image/png;base64,mockedImageData\"}";
    }

    // Helper operations

    private Path resolveAndValidate(String relativePath) throws Exception {
        if (relativePath == null) {
            return sandboxPath;
        }
        Path filePath = sandboxPath.resolve(relativePath).normalize();
        if (!filePath.startsWith(sandboxPath)) {
            throw new SecurityException("Security violation: Target path resides outside sandbox folder!");
        }
        return filePath;
    }

    private String runShellCommand(String cmd) throws Exception {
        ProcessBuilder pb = new ProcessBuilder("cmd.exe", "/c", cmd);
        pb.directory(sandboxPath.toFile());
        pb.redirectErrorStream(true);
        Process p = pb.start();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(p.getInputStream()))) {
            return reader.lines().collect(Collectors.joining("\n"));
        }
    }
}
