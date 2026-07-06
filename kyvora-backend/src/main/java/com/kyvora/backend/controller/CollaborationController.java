package com.kyvora.backend.controller;

import com.kyvora.backend.dto.MessageResponse;
import com.kyvora.backend.model.CollaborationSession;
import com.kyvora.backend.model.SessionParticipant;
import com.kyvora.backend.model.User;
import com.kyvora.backend.repository.UserRepository;
import com.kyvora.backend.repository.ChatMessageRepository;
import com.kyvora.backend.security.UserDetailsImpl;
import com.kyvora.backend.service.CollaborationSessionService;
import com.kyvora.backend.service.RedisPresenceService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/sessions")
public class CollaborationController {
    private final CollaborationSessionService sessionService;
    private final UserRepository userRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final RedisPresenceService presenceService;

    public CollaborationController(CollaborationSessionService sessionService,
                                   UserRepository userRepository,
                                   ChatMessageRepository chatMessageRepository,
                                   RedisPresenceService presenceService) {
        this.sessionService = sessionService;
        this.userRepository = userRepository;
        this.chatMessageRepository = chatMessageRepository;
        this.presenceService = presenceService;
    }

    @PostMapping
    public ResponseEntity<?> createSession(@AuthenticationPrincipal UserDetailsImpl userDetails,
                                           @RequestParam String title) {
        User user = userRepository.findById(userDetails.getId())
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        CollaborationSession session = sessionService.createSession(user, title);
        return ResponseEntity.ok(session);
    }

    @PostMapping("/{sessionId}/join")
    public ResponseEntity<?> joinSession(@AuthenticationPrincipal UserDetailsImpl userDetails,
                                         @PathVariable String sessionId,
                                         @RequestParam String secretToken) {
        try {
            User user = userRepository.findById(userDetails.getId())
                    .orElseThrow(() -> new IllegalArgumentException("User not found"));
            SessionParticipant participant = sessionService.joinSession(sessionId, user, secretToken);
            return ResponseEntity.ok(participant);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body(new MessageResponse("Error joining session: " + e.getMessage()));
        }
    }

    @PostMapping("/{sessionId}/close")
    public ResponseEntity<?> closeSession(@AuthenticationPrincipal UserDetailsImpl userDetails,
                                          @PathVariable String sessionId) {
        try {
            sessionService.closeSession(sessionId, userDetails.getId());
            return ResponseEntity.ok(new MessageResponse("Session closed successfully."));
        } catch (SecurityException e) {
            return ResponseEntity.status(403).body(new MessageResponse(e.getMessage()));
        }
    }

    @GetMapping("/recent")
    public ResponseEntity<?> getRecentSessions(@AuthenticationPrincipal UserDetailsImpl userDetails) {
        List<CollaborationSession> sessions = sessionService.getRecentSessionsForUser(userDetails.getId());
        return ResponseEntity.ok(sessions);
    }

    @GetMapping("/{sessionId}/participants")
    public ResponseEntity<?> getParticipants(@PathVariable String sessionId) {
        List<SessionParticipant> participants = sessionService.getAllParticipants(sessionId);
        return ResponseEntity.ok(participants);
    }

    @GetMapping("/{sessionId}/chat")
    public ResponseEntity<?> getChatLogs(@PathVariable String sessionId) {
        return ResponseEntity.ok(chatMessageRepository.findBySessionIdOrderByTimestampAsc(sessionId));
    }

    @GetMapping("/{sessionId}/presence")
    public ResponseEntity<?> getPresence(@PathVariable String sessionId) {
        return ResponseEntity.ok(presenceService.getSessionPresence(sessionId));
    }
}
