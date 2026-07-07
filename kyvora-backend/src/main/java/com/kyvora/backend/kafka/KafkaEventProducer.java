package com.kyvora.backend.kafka;

import com.kyvora.backend.dto.CollaborationEvent;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class KafkaEventProducer {
    private final KafkaTemplate<String, CollaborationEvent> kafkaTemplate;
    private final KafkaTemplate<String, String> stringKafkaTemplate;
    private final com.fasterxml.jackson.databind.ObjectMapper objectMapper;

    public KafkaEventProducer(KafkaTemplate<String, CollaborationEvent> kafkaTemplate,
                              KafkaTemplate<String, String> stringKafkaTemplate,
                              com.fasterxml.jackson.databind.ObjectMapper objectMapper) {
        this.kafkaTemplate = kafkaTemplate;
        this.stringKafkaTemplate = stringKafkaTemplate;
        this.objectMapper = objectMapper;
    }

    public void sendNotification(com.kyvora.backend.dto.NotificationEvent event) {
        log.info("Sending notification event to Kafka: {}", event.getType());
        try {
            String json = objectMapper.writeValueAsString(event);
            stringKafkaTemplate.send("kyvora-notifications", event.getUsername(), json)
                    .whenComplete((result, ex) -> {
                        if (ex != null) {
                            log.error("Failed to send notification event to Kafka: {}", ex.getMessage());
                        } else {
                            log.debug("Notification event sent successfully to Kafka, offset: {}", result.getRecordMetadata().offset());
                        }
                    });
        } catch (Exception e) {
            log.error("Failed to serialize notification event: {}", e.getMessage());
        }
    }

    public void sendCollaborationEvent(CollaborationEvent event) {
        log.debug("Sending collaboration event to Kafka: {}", event.getType());
        kafkaTemplate.send("kyvora-collaboration-events", event.getSessionId(), event)
                .whenComplete((result, ex) -> {
                    if (ex != null) {
                        log.error("Failed to send collaboration event to Kafka: {}", ex.getMessage());
                    } else {
                        log.debug("Collaboration event sent successfully: {}", result.getRecordMetadata().offset());
                    }
                });
    }

    public void sendChatEvent(CollaborationEvent event) {
        log.debug("Sending chat event to Kafka: {}", event.getType());
        kafkaTemplate.send("kyvora-chat-events", event.getSessionId(), event)
                .whenComplete((result, ex) -> {
                    if (ex != null) {
                        log.error("Failed to send chat event to Kafka: {}", ex.getMessage());
                    } else {
                        log.debug("Chat event sent successfully: {}", result.getRecordMetadata().offset());
                    }
                });
    }

    public void sendTerminalEvent(CollaborationEvent event) {
        log.debug("Sending terminal event to Kafka: {}", event.getType());
        kafkaTemplate.send("kyvora-terminal-events", event.getSessionId(), event)
                .whenComplete((result, ex) -> {
                    if (ex != null) {
                        log.error("Failed to send terminal event to Kafka: {}", ex.getMessage());
                    } else {
                        log.debug("Terminal event sent successfully: {}", result.getRecordMetadata().offset());
                    }
                });
    }
}
