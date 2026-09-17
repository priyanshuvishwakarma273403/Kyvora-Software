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

    @Data
    public static class AiSuggestRequest {
        private String filePath;
        private String contentBefore;
        private String contentAfter;
        private String provider;
        private String model;
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

    @PostMapping("/suggest")
    public ResponseEntity<?> getSuggestion(@RequestBody AiSuggestRequest request) {
        try {
            String provider = (request.getProvider() == null || request.getProvider().isEmpty()) ? "gemini" : request.getProvider();
            String model = request.getModel();
            
            String prompt = "You are a professional, high-speed inline code suggestion engine. Your task is to output the next few lines of code to insert at the cursor position.\n" +
                    "Context File: " + request.getFilePath() + "\n" +
                    "=== CODE BEFORE CURSOR ===\n" +
                    request.getContentBefore() + "\n" +
                    "=== CODE AFTER CURSOR ===\n" +
                    request.getContentAfter() + "\n" +
                    "=========================\n" +
                    "Generate ONLY the suggested code completion text. Do NOT write markdown, do NOT write markdown code blocks like ```, do NOT include explanations or notes. Just output the raw code snippet to complete the user's current line or block.";
            
            String response = aiGatewayService.callAi(provider, model, prompt);
            return ResponseEntity.ok(Map.of("suggestion", response));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }
}
