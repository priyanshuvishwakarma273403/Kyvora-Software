package com.kyvora.backend.kafka;

import com.kyvora.backend.dto.CollaborationEvent;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class KafkaEventProducer {
    private final KafkaTemplate<String, CollaborationEvent> kafkaTemplate;

    public KafkaEventProducer(KafkaTemplate<String, CollaborationEvent> kafkaTemplate) {
        this.kafkaTemplate = kafkaTemplate;
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
