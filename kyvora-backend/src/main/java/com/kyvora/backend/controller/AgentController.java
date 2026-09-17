package com.kyvora.backend.controller;

import com.kyvora.backend.service.AgentService;
import lombok.Data;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/ai/agent")
public class AgentController {

    private final AgentService agentService;
    private final com.kyvora.backend.service.StateGraphService stateGraphService;

    public AgentController(AgentService agentService, com.kyvora.backend.service.StateGraphService stateGraphService) {
        this.agentService = agentService;
        this.stateGraphService = stateGraphService;
    }

    @Data
    public static class AgentRunRequest {
        private String agentId;
        private String prompt;
        private String provider;
        private String model;
        private List<Map<String, String>> files;
    }

    @Data
    public static class GraphRunRequest {
        private String threadId;
        private String prompt;
        private String provider;
        private String model;
    }

    @Data
    public static class GraphResumeRequest {
        private String threadId;
        private boolean approved;
        private String feedback;
        private String provider;
        private String model;
    }

    @PostMapping("/run")
    public ResponseEntity<?> runAgent(@RequestBody AgentRunRequest request) {
        try {
            AgentService.AgentResult result = agentService.runAgent(
                    request.getAgentId(),
                    request.getPrompt(),
                    request.getProvider(),
                    request.getModel(),
                    request.getFiles()
            );
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of(
                    "status", "FAILED",
                    "error", e.getMessage()
            ));
        }
    }

    @PostMapping("/graph/run")
    public ResponseEntity<?> runGraph(@RequestBody GraphRunRequest request) {
        try {
            com.kyvora.backend.model.KyvoraState result = stateGraphService.executeGraph(
                    request.getThreadId(),
                    request.getPrompt(),
                    request.getProvider(),
                    request.getModel()
            );
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of(
                    "status", "FAILED",
                    "error", e.getMessage()
            ));
        }
    }

    @PostMapping("/graph/resume")
    public ResponseEntity<?> resumeGraph(@RequestBody GraphResumeRequest request) {
        try {
            com.kyvora.backend.model.KyvoraState result = stateGraphService.resumeGraph(
                    request.getThreadId(),
                    request.isApproved(),
                    request.getFeedback(),
                    request.getProvider(),
                    request.getModel()
            );
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of(
                    "status", "FAILED",
                    "error", e.getMessage()
            ));
        }
    }
}
