package com.kyvora.backend.websocket;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kyvora.backend.dto.CollaborationEvent;
import com.kyvora.backend.model.User;
import com.kyvora.backend.repository.UserRepository;
import com.kyvora.backend.service.CollaborationSessionService;
import com.kyvora.backend.service.RedisPresenceService;
import com.kyvora.backend.kafka.KafkaEventProducer;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

@Component
@Slf4j
public class CollaborationWebSocketHandler extends TextWebSocketHandler {

    private final Map<String, CopyOnWriteArrayList<WebSocketSession>> sessionGroups = new ConcurrentHashMap<>();
    private final ObjectMapper objectMapper;
    private final CollaborationSessionService sessionService;
    private final UserRepository userRepository;
    private final RedisPresenceService presenceService;
    private final KafkaEventProducer kafkaProducer;

    public CollaborationWebSocketHandler(ObjectMapper objectMapper,
                                         CollaborationSessionService sessionService,
                                         UserRepository userRepository,
                                         RedisPresenceService presenceService,
                                         KafkaEventProducer kafkaProducer) {
        this.objectMapper = objectMapper;
        this.sessionService = sessionService;
        this.userRepository = userRepository;
        this.presenceService = presenceService;
        this.kafkaProducer = kafkaProducer;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String username = (String) session.getAttributes().get("username");
        String sessionId = (String) session.getAttributes().get("sessionId");

        if (username == null || sessionId == null) {
            session.close(CloseStatus.BAD_DATA);
            return;
        }

        sessionGroups.computeIfAbsent(sessionId, k -> new CopyOnWriteArrayList<>()).add(session);
        log.info("WebSocket connection established. User: {}, Session: {}", username, sessionId);

        User user = userRepository.findByUsername(username).orElse(null);
        if (user != null) {
            // Update db participant status
            sessionService.updateParticipantStatus(sessionId, user.getId(), "ONLINE");

            // Cache in Redis
            RedisPresenceService.UserPresence presence = new RedisPresenceService.UserPresence();
            presence.setUserId(user.getId().toString());
            presence.setUsername(user.getUsername());
            presence.setStatus("ONLINE");
            presenceService.updateUserPresence(sessionId, presence);

            // Broadcast join event via Kafka
            CollaborationEvent event = CollaborationEvent.builder()
                    .type("USER_JOINED")
                    .sessionId(sessionId)
                    .userId(user.getId().toString())
                    .username(user.getUsername())
                    .payload(objectMapper.writeValueAsString(presence))
                    .timestamp(System.currentTimeMillis())
                    .build();
            kafkaProducer.sendCollaborationEvent(event);
        }
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String payload = message.getPayload();
        log.debug("Received websocket message: {}", payload);

        try {
            CollaborationEvent event = objectMapper.readValue(payload, CollaborationEvent.class);
            String username = (String) session.getAttributes().get("username");
            event.setUsername(username);

            // Forward to Kafka based on event type
            if ("CHAT_MESSAGE".equals(event.getType())) {
                kafkaProducer.sendChatEvent(event);
            } else if (event.getType().startsWith("TERMINAL_")) {
                kafkaProducer.sendTerminalEvent(event);
            } else {
                // Presence, cursor move, selection, file edit
                if ("CURSOR_MOVE".equals(event.getType()) || "SELECTION_CHANGE".equals(event.getType())) {
                    // Update Redis Presence info
                    RedisPresenceService.UserPresence presence = objectMapper.readValue(event.getPayload(), RedisPresenceService.UserPresence.class);
                    presenceService.updateUserPresence(event.getSessionId(), presence);
                }
                kafkaProducer.sendCollaborationEvent(event);
            }
        } catch (Exception e) {
            log.error("Failed to parse or route message: {}", e.getMessage());
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        String username = (String) session.getAttributes().get("username");
        String sessionId = (String) session.getAttributes().get("sessionId");

        if (sessionId != null) {
            CopyOnWriteArrayList<WebSocketSession> group = sessionGroups.get(sessionId);
            if (group != null) {
                group.remove(session);
                if (group.isEmpty()) {
                    sessionGroups.remove(sessionId);
                }
            }

            if (username != null) {
                log.info("WebSocket connection closed. User: {}, Session: {}", username, sessionId);
                User user = userRepository.findByUsername(username).orElse(null);
                if (user != null) {
                    sessionService.updateParticipantStatus(sessionId, user.getId(), "OFFLINE");
                    presenceService.removeUserPresence(sessionId, user.getId().toString());

                    CollaborationEvent event = CollaborationEvent.builder()
                            .type("USER_LEFT")
                            .sessionId(sessionId)
                            .userId(user.getId().toString())
                            .username(user.getUsername())
                            .payload("{}")
                            .timestamp(System.currentTimeMillis())
                            .build();
                    kafkaProducer.sendCollaborationEvent(event);
                }
            }
        }
    }

    public void broadcastToSession(String sessionId, CollaborationEvent event) {
        CopyOnWriteArrayList<WebSocketSession> sessions = sessionGroups.get(sessionId);
        if (sessions != null) {
            try {
                String messageJson = objectMapper.writeValueAsString(event);
                TextMessage textMessage = new TextMessage(messageJson);
                for (WebSocketSession s : sessions) {
                    if (s.isOpen()) {
                        // Avoid echoes for user edits if we want, or just send to all. Usually client handles echoing.
                        try {
                            s.sendMessage(textMessage);
                        } catch (IOException e) {
                            log.error("Failed to send message to user {}: {}", s.getAttributes().get("username"), e.getMessage());
                        }
                    }
                }
            } catch (Exception e) {
                log.error("Failed to serialize message: {}", e.getMessage());
            }
        }
    }
}
