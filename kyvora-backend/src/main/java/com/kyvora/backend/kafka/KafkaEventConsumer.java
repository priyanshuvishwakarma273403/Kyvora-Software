package com.kyvora.backend.kafka;

import com.kyvora.backend.dto.CollaborationEvent;
import com.kyvora.backend.service.AiGatewayService;
import com.kyvora.backend.websocket.CollaborationWebSocketHandler;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

import java.util.concurrent.CompletableFuture;

@Service
@Slf4j
public class KafkaEventConsumer {
    private final CollaborationWebSocketHandler webSocketHandler;
    private final KafkaTemplate<String, CollaborationEvent> kafkaTemplate;
    private final AiGatewayService aiGatewayService;

    public KafkaEventConsumer(CollaborationWebSocketHandler webSocketHandler,
                              KafkaTemplate<String, CollaborationEvent> kafkaTemplate,
                              AiGatewayService aiGatewayService) {
        this.webSocketHandler = webSocketHandler;
        this.kafkaTemplate = kafkaTemplate;
        this.aiGatewayService = aiGatewayService;
    }

    @KafkaListener(topics = "kyvora-collaboration-events", groupId = "kyvora-collaboration-group")
    public void consumeCollaborationEvent(CollaborationEvent event) {
        log.debug("Consumed collaboration event from Kafka: {}", event.getType());
        try {
            webSocketHandler.broadcastToSession(event.getSessionId(), event);
        } catch (Exception e) {
            log.error("Failed to process consumed collaboration event: {}. Forwarding to DLQ.", e.getMessage());
            forwardToDlq(event, "kyvora-collaboration-events-dlq");
        }
    }

    @KafkaListener(topics = "kyvora-chat-events", groupId = "kyvora-collaboration-group")
    public void consumeChatEvent(CollaborationEvent event) {
        log.debug("Consumed chat event from Kafka: {}", event.getType());
        try {
            webSocketHandler.broadcastToSession(event.getSessionId(), event);
            
            // Trigger AI response async if the message is from a regular user
            if ("CHAT_MESSAGE".equals(event.getType()) && !"KyvoraAI".equals(event.getUsername())) {
                triggerAiResponse(event);
            }
        } catch (Exception e) {
            log.error("Failed to process consumed chat event: {}. Forwarding to DLQ.", e.getMessage());
            forwardToDlq(event, "kyvora-chat-events-dlq");
        }
    }

    @KafkaListener(topics = "kyvora-terminal-events", groupId = "kyvora-collaboration-group")
    public void consumeTerminalEvent(CollaborationEvent event) {
        log.debug("Consumed terminal event from Kafka: {}", event.getType());
        try {
            webSocketHandler.broadcastToSession(event.getSessionId(), event);
        } catch (Exception e) {
            log.error("Failed to process consumed terminal event: {}. Forwarding to DLQ.", e.getMessage());
            forwardToDlq(event, "kyvora-terminal-events-dlq");
        }
    }

    private void triggerAiResponse(CollaborationEvent event) {
        CompletableFuture.runAsync(() -> {
            try {
                String userMessage = event.getPayload();
                log.info("Generating AI response for chat message from user {} in session {}", event.getUsername(), event.getSessionId());

                String systemPrompt = "You are KyvoraAI, a helpful, human-like programming assistant and collaborator in a live Kyvora Collaboration Hub session. "
                        + "The user just sent this message: \"" + userMessage + "\".\n\n"
                        + "Please respond to them in a friendly, conversational, natural human-like manner. If they ask for help with code, feel free to provide short explanations or snippets.\n\n"
                        + "CRITICAL: At the very end of your response, you MUST provide exactly 2-3 short, context-aware suggestions for what the user can reply or ask next. "
                        + "Format these suggestions EXACTLY like this (each suggestion on a new line inside the tags, do not put any introductory text before the suggestions, and do not use bullet points or numbers):\n"
                        + "[SUGGESTIONS]\n"
                        + "Suggestion reply 1\n"
                        + "Suggestion reply 2\n"
                        + "[/SUGGESTIONS]\n\n"
                        + "Make sure there are no bullet points, numbers, or dashes inside the suggestions tags. Just raw suggestion text per line.";

                String aiResponse;
                try {
                    aiResponse = aiGatewayService.callAi("gemini", "gemini-1.5-flash", systemPrompt);
                } catch (Exception e) {
                    log.error("Failed to call Gemini AI: {}. Trying fallback Groq.", e.getMessage());
                    try {
                        aiResponse = aiGatewayService.callAi("groq", "llama-3.1-8b-instant", systemPrompt);
                    } catch (Exception ex) {
                        log.error("All AI providers failed: {}", ex.getMessage());
                        aiResponse = "I'm sorry, I'm having trouble connecting to my AI core right now. Please try again in a moment!\n[SUGGESTIONS]\nTry again\nAre the keys configured?\n[/SUGGESTIONS]";
                    }
                }

                if (aiResponse == null || aiResponse.isEmpty()) {
                    aiResponse = "I'm sorry, I couldn't generate a response. How else can I assist you?\n[SUGGESTIONS]\nAsk another question\nExplain Java basics\nTell me about Kyvora\n[/SUGGESTIONS]";
                } else if (!aiResponse.contains("[SUGGESTIONS]")) {
                    aiResponse += "\n\n[SUGGESTIONS]\nHow does this work?\nCan you explain more?\nShow another example\n[/SUGGESTIONS]";
                }

                CollaborationEvent aiEvent = CollaborationEvent.builder()
                        .type("CHAT_MESSAGE")
                        .sessionId(event.getSessionId())
                        .userId("KyvoraAI")
                        .username("KyvoraAI")
                        .payload(aiResponse)
                        .timestamp(System.currentTimeMillis())
                        .build();

                kafkaTemplate.send("kyvora-chat-events", event.getSessionId(), aiEvent);
                log.info("AI response successfully broadcasted to session {}", event.getSessionId());
            } catch (Exception e) {
                log.error("Failed to generate and send AI response: {}", e.getMessage());
            }
        });
    }

    private void forwardToDlq(CollaborationEvent event, String dlqTopic) {
        kafkaTemplate.send(dlqTopic, event.getSessionId(), event)
                .whenComplete((result, ex) -> {
                    if (ex != null) {
                        log.error("Failed to route to DLQ: {}", ex.getMessage());
                    } else {
                        log.warn("Routed dead letter payload to: {} offset: {}", dlqTopic, result.getRecordMetadata().offset());
                    }
                });
    }
}
