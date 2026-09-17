package com.kyvora.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;
import java.util.Map;

@Service
@Slf4j
public class AiGatewayService {
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;

    @Value("${kyvora.ai.gemini.api-key:}")
    private String geminiApiKey;

    @Value("${kyvora.ai.openrouter.api-key:}")
    private String openrouterApiKey;

    @Value("${kyvora.ai.groq.api-key:}")
    private String groqApiKey;

    @Value("${kyvora.ai.sambanova.api-key:}")
    private String sambanovaApiKey;

    @Value("${kyvora.ai.huggingface.api-key:}")
    private String huggingfaceApiKey;

    @Value("${kyvora.ai.local.url:http://localhost:8081/v1/chat/completions}")
    private String localLlamaUrl;

    public AiGatewayService(ObjectMapper objectMapper) {
        this.httpClient = HttpClient.newHttpClient();
        this.objectMapper = objectMapper;
    }

    public String callAi(String provider, String model, String prompt) throws Exception {
        log.info("AI call requested. Provider: {}, Model: {}", provider, model);
        try {
            return executeCall(provider, model, prompt);
        } catch (Exception e) {
            log.warn("Primary AI provider '{}' failed: {}. Initiating failover...", provider, e.getMessage());
            
            // Failover chain: we will attempt alternative configured providers in sequence.
            java.util.List<String> failoverChain = java.util.List.of("gemini", "openrouter", "groq", "sambanova", "huggingface", "local");
            for (String altProvider : failoverChain) {
                if (altProvider.equalsIgnoreCase(provider)) {
                    continue; // Skip the failed primary provider
                }
                if (!isConfigured(altProvider)) {
                    log.debug("Failover provider '{}' is not configured, skipping.", altProvider);
                    continue; 
                }
                try {
                    log.info("Attempting failover to provider: {}", altProvider);
                    String response = executeCall(altProvider, getDefaultModel(altProvider), prompt);
                    log.info("Failover to provider '{}' succeeded!", altProvider);
                    return response;
                } catch (Exception ex) {
                    log.error("Failover provider '{}' failed: {}", altProvider, ex.getMessage());
                }
            }
            throw new RuntimeException("All AI providers in the failover chain failed! Original error: " + e.getMessage(), e);
        }
    }

    public String generateCompletion(String systemPrompt, String userPrompt, String provider, String model) throws Exception {
        String fullPrompt = systemPrompt + "\n\n" + userPrompt;
        return callAi(provider, model, fullPrompt);
    }

    public boolean isConfigured(String provider) {
        return switch (provider.toLowerCase()) {
            case "gemini" -> geminiApiKey != null && !geminiApiKey.isEmpty();
            case "openrouter" -> openrouterApiKey != null && !openrouterApiKey.isEmpty();
            case "groq" -> groqApiKey != null && !groqApiKey.isEmpty();
            case "sambanova" -> sambanovaApiKey != null && !sambanovaApiKey.isEmpty();
            case "huggingface" -> huggingfaceApiKey != null && !huggingfaceApiKey.isEmpty();
            case "local", "llamacpp" -> true; // Assume local is always a candidate
            default -> false;
        };
    }

    private String getDefaultModel(String provider) {
        return switch (provider.toLowerCase()) {
            case "gemini" -> "gemini-1.5-pro";
            case "openrouter" -> "google/gemini-2.5-pro";
            case "groq" -> "mixtral-8x7b-32768";
            case "sambanova" -> "Meta-Llama-3.1-70B-Instruct";
            case "huggingface" -> "mistralai/Mistral-7B-Instruct-v0.3";
            case "local", "llamacpp" -> "local-model";
            default -> "";
        };
    }

    private String executeCall(String provider, String model, String prompt) throws Exception {
        return switch (provider.toLowerCase()) {
            case "gemini" -> callGemini(model, prompt);
            case "groq" -> callGroq(model, prompt);
            case "openrouter" -> callOpenRouter(model, prompt);
            case "sambanova" -> callSambaNova(model, prompt);
            case "huggingface" -> callHuggingFace(model, prompt);
            case "local", "llamacpp" -> callLocalLlama(model, prompt);
            default -> throw new IllegalArgumentException("Unsupported AI provider: " + provider);
        };
    }

    private String callGemini(String model, String prompt) throws Exception {
        if (geminiApiKey.isEmpty()) {
            throw new IllegalStateException("Gemini API key is not configured");
        }
        
        String actualModel = (model == null || model.isEmpty()) ? "gemini-1.5-pro" : model;
        String url = "https://generativelanguage.googleapis.com/v1beta/models/" + actualModel + ":generateContent?key=" + geminiApiKey;

        Map<String, Object> requestBody = Map.of(
                "contents", List.of(
                        Map.of("parts", List.of(
                                Map.of("text", prompt)
                        ))
                )
        );

        String jsonPayload = objectMapper.writeValueAsString(requestBody);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(jsonPayload))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            throw new RuntimeException("Gemini API call failed with status: " + response.statusCode() + " details: " + response.body());
        }

        Map<?, ?> responseMap = objectMapper.readValue(response.body(), Map.class);
        List<?> candidates = (List<?>) responseMap.get("candidates");
        if (candidates != null && !candidates.isEmpty()) {
            Map<?, ?> firstCandidate = (Map<?, ?>) candidates.get(0);
            Map<?, ?> content = (Map<?, ?>) firstCandidate.get("content");
            List<?> parts = (List<?>) content.get("parts");
            if (parts != null && !parts.isEmpty()) {
                Map<?, ?> firstPart = (Map<?, ?>) parts.get(0);
                return (String) firstPart.get("text");
            }
        }
        return "No text response generated by Gemini.";
    }

    private String callGroq(String model, String prompt) throws Exception {
        if (groqApiKey.isEmpty()) {
            throw new IllegalStateException("Groq API key is not configured");
        }

        String actualModel = (model == null || model.isEmpty()) ? "mixtral-8x7b-32768" : model;
        String url = "https://api.groq.com/openai/v1/chat/completions";

        Map<String, Object> requestBody = Map.of(
                "model", actualModel,
                "messages", List.of(
                        Map.of("role", "user", "content", prompt)
                )
        );

        String jsonPayload = objectMapper.writeValueAsString(requestBody);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + groqApiKey)
                .POST(HttpRequest.BodyPublishers.ofString(jsonPayload))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            throw new RuntimeException("Groq API call failed with status: " + response.statusCode() + " details: " + response.body());
        }

        Map<?, ?> responseMap = objectMapper.readValue(response.body(), Map.class);
        List<?> choices = (List<?>) responseMap.get("choices");
        if (choices != null && !choices.isEmpty()) {
            Map<?, ?> firstChoice = (Map<?, ?>) choices.get(0);
            Map<?, ?> message = (Map<?, ?>) firstChoice.get("message");
            return (String) message.get("content");
        }
        return "No text response generated by Groq.";
    }

    private String callOpenRouter(String model, String prompt) throws Exception {
        if (openrouterApiKey.isEmpty()) {
            throw new IllegalStateException("OpenRouter API key is not configured");
        }

        String actualModel = (model == null || model.isEmpty()) ? "google/gemini-2.5-pro" : model;
        String url = "https://openrouter.ai/api/v1/chat/completions";

        Map<String, Object> requestBody = Map.of(
                "model", actualModel,
                "messages", List.of(
                        Map.of("role", "user", "content", prompt)
                )
        );

        String jsonPayload = objectMapper.writeValueAsString(requestBody);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + openrouterApiKey)
                .header("HTTP-Referer", "https://kyvora.io")
                .header("X-Title", "Kyvora Studio")
                .POST(HttpRequest.BodyPublishers.ofString(jsonPayload))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            throw new RuntimeException("OpenRouter API call failed with status: " + response.statusCode() + " details: " + response.body());
        }

        Map<?, ?> responseMap = objectMapper.readValue(response.body(), Map.class);
        List<?> choices = (List<?>) responseMap.get("choices");
        if (choices != null && !choices.isEmpty()) {
            Map<?, ?> firstChoice = (Map<?, ?>) choices.get(0);
            Map<?, ?> message = (Map<?, ?>) firstChoice.get("message");
            return (String) message.get("content");
        }
        return "No text response generated by OpenRouter.";
    }

    private String callLocalLlama(String model, String prompt) throws Exception {
        log.info("Calling local Llama.cpp inference server at {}", localLlamaUrl);
        String actualModel = (model == null || model.isEmpty()) ? "local-model" : model;

        Map<String, Object> requestBody = Map.of(
                "model", actualModel,
                "messages", List.of(
                        Map.of("role", "user", "content", prompt)
                )
        );

        String jsonPayload = objectMapper.writeValueAsString(requestBody);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(localLlamaUrl))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(jsonPayload))
                .build();

        try {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                throw new RuntimeException("Local Llama.cpp call failed with status: " + response.statusCode() + " details: " + response.body());
            }

            Map<?, ?> responseMap = objectMapper.readValue(response.body(), Map.class);
            List<?> choices = (List<?>) responseMap.get("choices");
            if (choices != null && !choices.isEmpty()) {
                Map<?, ?> firstChoice = (Map<?, ?>) choices.get(0);
                Map<?, ?> message = (Map<?, ?>) firstChoice.get("message");
                return (String) message.get("content");
            }
            return "No response from local Llama.cpp.";
        } catch (java.net.ConnectException e) {
            log.error("Local Llama.cpp server is offline. Connection refused to: {}", localLlamaUrl);
            throw new IllegalStateException("Local Llama.cpp server at " + localLlamaUrl + " is offline/unavailable. Please verify that Llama.cpp is running locally.");
        }
    }

    private String callSambaNova(String model, String prompt) throws Exception {
        if (sambanovaApiKey.isEmpty()) {
            throw new IllegalStateException("SambaNova API key is not configured");
        }
        String actualModel = (model == null || model.isEmpty()) ? "Meta-Llama-3.1-70B-Instruct" : model;
        String url = "https://api.sambanova.ai/v1/chat/completions";

        Map<String, Object> requestBody = Map.of(
                "model", actualModel,
                "messages", List.of(
                        Map.of("role", "user", "content", prompt)
                )
        );

        String jsonPayload = objectMapper.writeValueAsString(requestBody);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + sambanovaApiKey)
                .POST(HttpRequest.BodyPublishers.ofString(jsonPayload))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            throw new RuntimeException("SambaNova API call failed with status: " + response.statusCode() + " details: " + response.body());
        }

        Map<?, ?> responseMap = objectMapper.readValue(response.body(), Map.class);
        List<?> choices = (List<?>) responseMap.get("choices");
        if (choices != null && !choices.isEmpty()) {
            Map<?, ?> firstChoice = (Map<?, ?>) choices.get(0);
            Map<?, ?> message = (Map<?, ?>) firstChoice.get("message");
            return (String) message.get("content");
        }
        return "No text response generated by SambaNova.";
    }

    private String callHuggingFace(String model, String prompt) throws Exception {
        if (huggingfaceApiKey.isEmpty()) {
            throw new IllegalStateException("HuggingFace API key is not configured");
        }
        String actualModel = (model == null || model.isEmpty()) ? "mistralai/Mistral-7B-Instruct-v0.3" : model;
        String url = "https://api-inference.huggingface.co/models/" + actualModel;

        Map<String, Object> requestBody = Map.of("inputs", prompt);
        String jsonPayload = objectMapper.writeValueAsString(requestBody);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + huggingfaceApiKey)
                .POST(HttpRequest.BodyPublishers.ofString(jsonPayload))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            throw new RuntimeException("HuggingFace API call failed with status: " + response.statusCode() + " details: " + response.body());
        }

        try {
            List<?> responseList = objectMapper.readValue(response.body(), List.class);
            if (responseList != null && !responseList.isEmpty()) {
                Map<?, ?> firstItem = (Map<?, ?>) responseList.get(0);
                if (firstItem.containsKey("generated_text")) {
                    return (String) firstItem.get("generated_text");
                }
            }
        } catch (Exception e) {
            Map<?, ?> responseMap = objectMapper.readValue(response.body(), Map.class);
            if (responseMap.containsKey("generated_text")) {
                return (String) responseMap.get("generated_text");
            }
        }
        return response.body();
    }
}
