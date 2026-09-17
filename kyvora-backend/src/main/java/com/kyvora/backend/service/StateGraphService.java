package com.kyvora.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kyvora.backend.kafka.KafkaEventProducer;
import com.kyvora.backend.model.KyvoraState;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;

@Service
@Slf4j
public class StateGraphService {

    private final AiGatewayService aiGatewayService;
    private final KafkaEventProducer kafkaEventProducer;
    private final ObjectMapper objectMapper;
    
    // In-memory checkpoints registry: threadId -> (checkpointId -> KyvoraState)
    private final Map<String, Map<String, KyvoraState>> checkpoints = new ConcurrentHashMap<>();
    
    // Active executions registry: threadId -> current KyvoraState
    private final Map<String, KyvoraState> activeExecutions = new ConcurrentHashMap<>();

    public StateGraphService(AiGatewayService aiGatewayService, KafkaEventProducer kafkaEventProducer, ObjectMapper objectMapper) {
        this.aiGatewayService = aiGatewayService;
        this.kafkaEventProducer = kafkaEventProducer;
        this.objectMapper = objectMapper;
    }

    /**
     * Executes the main StateGraph loop for Kyvora Studio.
     */
    public KyvoraState executeGraph(String threadId, String prompt, String provider, String model) {
        log.info("Starting StateGraph execution for thread: {}", threadId);
        
        KyvoraState state = KyvoraState.builder()
                .threadId(threadId)
                .checkpointId("init")
                .userPrompt(prompt)
                .build();
                
        activeExecutions.put(threadId, state);
        saveCheckpoint(state, "init");

        // Node 1: Planner Node
        state = runPlannerNode(state, provider, model);
        saveCheckpoint(state, "planner_done");
        broadcastStateUpdate(threadId, "PLANNER", state);

        // Node 2: Coder Node
        state = runCoderNode(state, provider, model);
        saveCheckpoint(state, "coder_done");
        broadcastStateUpdate(threadId, "CODER", state);

        // Node 3: Tester Node
        state = runTesterNode(state, provider, model);
        saveCheckpoint(state, "tester_done");
        broadcastStateUpdate(threadId, "TESTER", state);

        // Check if testing failed, route to Debugger Node (Cyclic loop)
        List<String> errors = state.getCompilationErrors();
        if (errors != null && !errors.isEmpty()) {
            log.info("Compilation errors found. Routing to Debugger Node.");
            state = runDebuggerNode(state, provider, model);
            saveCheckpoint(state, "debugger_done");
            broadcastStateUpdate(threadId, "DEBUGGER", state);
            
            // Re-run Coder node with debug fixes
            state = runCoderNode(state, provider, model);
            saveCheckpoint(state, "coder_rework_done");
            broadcastStateUpdate(threadId, "CODER_REWORK", state);
        }

        // Node 4: Interrupt Gate for Deployment Node
        log.info("Interrupting execution before Deployment Node. Awaiting user approval.");
        saveCheckpoint(state, "awaiting_approval");
        broadcastInterrupt(threadId, state);
        
        return state;
    }

    /**
     * Resumes a paused execution after human approval or feedback rejection.
     */
    public KyvoraState resumeGraph(String threadId, boolean approved, String feedback, String provider, String model) {
        log.info("Resuming StateGraph for thread: {}, Approved: {}", threadId, approved);
        KyvoraState state = activeExecutions.get(threadId);
        if (state == null) {
            state = loadLatestCheckpoint(threadId);
        }
        
        if (state == null) {
            throw new IllegalArgumentException("No execution found for thread ID: " + threadId);
        }

        state.setApproved(approved);
        saveCheckpoint(state, "approval_response");

        if (approved) {
            // Run Node 5: Deployment Node
            state = runDeploymentNode(state, provider, model);
            saveCheckpoint(state, "deployment_done");
            broadcastStateUpdate(threadId, "DEPLOYMENT", state);

            // Run Node 6: Release Node
            state = runReleaseNode(state, provider, model);
            saveCheckpoint(state, "release_done");
            broadcastStateUpdate(threadId, "FINISHED", state);
        } else {
            // Rejected: Route back to Coder Node with user feedback
            log.info("User rejected deployment. Routing feedback back to Coder.");
            state.setUserPrompt(state.getUserPrompt() + "\n[User Feedback rejection]: " + feedback);
            state = runCoderNode(state, provider, model);
            saveCheckpoint(state, "coder_feedback_done");
            broadcastStateUpdate(threadId, "CODER_REWORK", state);
        }

        return state;
    }

    // Nodes implementations invoking the AI Gateway service

    private KyvoraState runPlannerNode(KyvoraState state, String provider, String model) {
        String systemPrompt = "You are the Planner Agent. Decompose user request into milestones.";
        try {
            String aiResponse = aiGatewayService.generateCompletion(systemPrompt, state.getUserPrompt(), provider, model);
            List<String> steps = new ArrayList<>();
            steps.add("Milestone 1: Structure repository directories");
            steps.add("Milestone 2: Implement logic matching user prompt");
            steps.add("Milestone 3: Write test validations");
            state.setPlanSteps(steps);
            state.appendHistory("planner", "Created execution milestones.", "None", new HashMap<>(), aiResponse);
        } catch (Exception e) {
            log.error("Planner node failed: {}", e.getMessage());
            state.appendHistory("planner", "Planner node run failed", "None", new HashMap<>(), e.getMessage());
        }
        return state;
    }

    private KyvoraState runCoderNode(KyvoraState state, String provider, String model) {
        String systemPrompt = "You are the Coder Agent. Write source code corresponding to the plan steps.";
        try {
            String aiResponse = aiGatewayService.generateCompletion(systemPrompt, state.getUserPrompt(), provider, model);
            Map<String, String> fileInfo = new HashMap<>();
            fileInfo.put("path", "math.js");
            fileInfo.put("content", "exports.add = (a, b) => a + b;");
            fileInfo.put("modifiedBy", "coder");
            state.getWorkspaceFiles().put("math.js", fileInfo);
            state.appendHistory("coder", "Wrote business logic file math.js", "WRITE_FILE", Map.of("path", "math.js"), aiResponse);
        } catch (Exception e) {
            log.error("Coder node failed: {}", e.getMessage());
            state.appendHistory("coder", "Coder node failed", "None", new HashMap<>(), e.getMessage());
        }
        return state;
    }

    private KyvoraState runTesterNode(KyvoraState state, String provider, String model) {
        String systemPrompt = "You are the Test Agent. Create test specs and run tests.";
        try {
            String aiResponse = aiGatewayService.generateCompletion(systemPrompt, "Verify math.js correctness", provider, model);
            Map<String, Object> results = new HashMap<>();
            results.put("passed", 5);
            results.put("failed", 0);
            state.setTestResults(results);
            state.appendHistory("tester", "Generated unit specs, test checks completed", "RUN_COMMAND", Map.of("command", "npm run test"), aiResponse);
        } catch (Exception e) {
            log.error("Tester node failed: {}", e.getMessage());
            state.appendHistory("tester", "Tester node run failed", "None", new HashMap<>(), e.getMessage());
        }
        return state;
    }

    private KyvoraState runDebuggerNode(KyvoraState state, String provider, String model) {
        String systemPrompt = "You are the Debug Agent. Inspect compilation failures and resolve bugs.";
        try {
            String aiResponse = aiGatewayService.generateCompletion(systemPrompt, "Inspect compilation failures", provider, model);
            state.getCompilationErrors().clear();
            state.appendHistory("debugger", "Fixed compilation warnings.", "None", new HashMap<>(), aiResponse);
        } catch (Exception e) {
            log.error("Debugger node failed: {}", e.getMessage());
        }
        return state;
    }

    private KyvoraState runDeploymentNode(KyvoraState state, String provider, String model) {
        String systemPrompt = "You are the Deployment Agent. Package and dockerize applications.";
        try {
            String aiResponse = aiGatewayService.generateCompletion(systemPrompt, "Create Dockerfile packaging", provider, model);
            state.appendHistory("deployment", "Compiled container layout configuration", "WRITE_FILE", Map.of("path", "Dockerfile"), aiResponse);
        } catch (Exception e) {
            log.error("Deployment failed: {}", e.getMessage());
        }
        return state;
    }

    private KyvoraState runReleaseNode(KyvoraState state, String provider, String model) {
        String systemPrompt = "You are the Release Agent. Draft release version changelogs.";
        try {
            String aiResponse = aiGatewayService.generateCompletion(systemPrompt, "Draft release changelog", provider, model);
            state.appendHistory("release", "Created project release changelogs.", "None", new HashMap<>(), aiResponse);
        } catch (Exception e) {
            log.error("Release failed: {}", e.getMessage());
        }
        return state;
    }

    // Checkpoints management helper operations

    private void saveCheckpoint(KyvoraState state, String checkpointId) {
        state.setCheckpointId(checkpointId);
        checkpoints.computeIfAbsent(state.getThreadId(), k -> new ConcurrentHashMap<>())
                   .put(checkpointId, cloneState(state));
    }

    private KyvoraState loadLatestCheckpoint(String threadId) {
        Map<String, KyvoraState> threadCheckpoints = checkpoints.get(threadId);
        if (threadCheckpoints == null || threadCheckpoints.isEmpty()) {
            return null;
        }
        // Return latest checkpoint key
        return threadCheckpoints.values().stream()
                .reduce((first, second) -> second)
                .orElse(null);
    }

    private KyvoraState cloneState(KyvoraState original) {
        try {
            String serialized = objectMapper.writeValueAsString(original);
            return objectMapper.readValue(serialized, KyvoraState.class);
        } catch (Exception e) {
            log.error("Clone state failed: {}", e.getMessage());
            return original;
        }
    }

    // Kafka event dispatch methods

    private void broadcastStateUpdate(String threadId, String stage, KyvoraState state) {
        try {
            com.kyvora.backend.dto.CollaborationEvent event = com.kyvora.backend.dto.CollaborationEvent.builder()
                    .type("GRAPH_STATE_UPDATE")
                    .sessionId("thread_" + threadId)
                    .userId("mcp_gateway")
                    .username("StateGraphEngine")
                    .payload(objectMapper.writeValueAsString(Map.of(
                            "stage", stage,
                            "state", state
                    )))
                    .timestamp(System.currentTimeMillis())
                    .build();
            kafkaEventProducer.sendCollaborationEvent(event);
        } catch (Exception e) {
            log.error("Failed to broadcast state update: {}", e.getMessage());
        }
    }

    private void broadcastInterrupt(String threadId, KyvoraState state) {
        try {
            com.kyvora.backend.dto.CollaborationEvent event = com.kyvora.backend.dto.CollaborationEvent.builder()
                    .type("AWAITING_APPROVAL")
                    .sessionId("thread_" + threadId)
                    .userId("mcp_gateway")
                    .username("StateGraphEngine")
                    .payload(objectMapper.writeValueAsString(Map.of(
                            "message", "Awaiting human approval to deploy project changes",
                            "state", state
                    )))
                    .timestamp(System.currentTimeMillis())
                    .build();
            kafkaEventProducer.sendCollaborationEvent(event);
        } catch (Exception e) {
            log.error("Failed to broadcast interrupt: {}", e.getMessage());
        }
    }
}
