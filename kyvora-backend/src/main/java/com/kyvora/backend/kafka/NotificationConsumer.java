package com.kyvora.backend.kafka;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kyvora.backend.dto.NotificationEvent;
import com.kyvora.backend.service.EmailService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

@Service
@Slf4j
public class NotificationConsumer {

    private final EmailService emailService;
    private final ObjectMapper objectMapper;
    private static final DateTimeFormatter DATE_TIME_FORMATTER = 
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss").withZone(ZoneId.systemDefault());

    public NotificationConsumer(EmailService emailService, ObjectMapper objectMapper) {
        this.emailService = emailService;
        this.objectMapper = objectMapper;
    }

    @KafkaListener(topics = "kyvora-notifications", groupId = "kyvora-notification-group")
    public void consumeNotification(String eventJson) {
        log.info("Received raw notification event from Kafka: {}", eventJson);
        try {
            NotificationEvent event = objectMapper.readValue(eventJson, NotificationEvent.class);
            log.info("Processing notification event: Type={}, User={}", event.getType(), event.getUsername());

            String timeStr = DATE_TIME_FORMATTER.format(Instant.ofEpochMilli(event.getTimestamp()));
            
            // Build a beautiful email body
            StringBuilder bodyBuilder = new StringBuilder();
            bodyBuilder.append("=== Kyvora Alert System ===\n\n");
            bodyBuilder.append("An important security or system activity occurred in Kyvora.\n\n");
            bodyBuilder.append("Event Type: ").append(event.getType()).append("\n");
            bodyBuilder.append("Client Type: ").append(event.getClient() != null ? event.getClient().toUpperCase() : "WEB/UNKNOWN").append("\n");
            bodyBuilder.append("User: ").append(event.getUsername()).append("\n");
            bodyBuilder.append("Email: ").append(event.getEmail() != null ? event.getEmail() : "N/A").append("\n");
            bodyBuilder.append("Time: ").append(timeStr).append("\n");
            bodyBuilder.append("Details: ").append(event.getMessage()).append("\n\n");
            bodyBuilder.append("This is an automated notification from your Kyvora Backend instance.\n");

            String subject = String.format("[Kyvora Alert] %s - %s", event.getType(), event.getUsername());
            emailService.sendNotificationEmail(subject, bodyBuilder.toString());

        } catch (Exception e) {
            log.error("Failed to parse or process notification event: {}", e.getMessage(), e);
        }
    }
}
