package com.kyvora.backend.controller;

import com.kyvora.backend.service.AiGatewayService;
import lombok.Data;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/ai")
public class AiGatewayController {
    private final AiGatewayService aiGatewayService;

    public AiGatewayController(AiGatewayService aiGatewayService) {
        this.aiGatewayService = aiGatewayService;
    }

    @Data
    public static class AiCompletionRequest {
        private String provider;
        private String model;
        private String prompt;
    }

    @PostMapping("/completion")
    public ResponseEntity<?> getCompletion(@RequestBody AiCompletionRequest request) {
        try {
            String response = aiGatewayService.callAi(request.getProvider(), request.getModel(), request.getPrompt());
            return ResponseEntity.ok(Map.of("text", response));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }
}
