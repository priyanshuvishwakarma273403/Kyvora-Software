package com.kyvora.backend.service;

import com.kyvora.backend.model.CollaborationSession;
import com.kyvora.backend.model.SessionParticipant;
import com.kyvora.backend.model.User;
import com.kyvora.backend.repository.CollaborationSessionRepository;
import com.kyvora.backend.repository.SessionParticipantRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class CollaborationSessionService {
    private final CollaborationSessionRepository sessionRepository;
    private final SessionParticipantRepository participantRepository;

    public CollaborationSessionService(CollaborationSessionRepository sessionRepository,
                                        SessionParticipantRepository participantRepository) {
        this.sessionRepository = sessionRepository;
        this.participantRepository = participantRepository;
    }

    @Transactional
    public CollaborationSession createSession(User host, String title) {
        String sessionId = UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase();
        String secretToken = UUID.randomUUID().toString();

        CollaborationSession session = CollaborationSession.builder()
                .id(sessionId)
                .host(host)
                .title(title)
                .secretToken(secretToken)
                .active(true)
                .build();

        sessionRepository.save(session);

        SessionParticipant participant = SessionParticipant.builder()
                .session(session)
                .user(host)
                .role("HOST")
                .status("ONLINE")
                .permissionLevel("ADMIN")
                .build();

        participantRepository.save(participant);

        return session;
    }

    @Transactional
    public SessionParticipant joinSession(String sessionId, User user, String secretToken) {
        CollaborationSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new IllegalArgumentException("Session not found: " + sessionId));

        if (!session.isActive()) {
            throw new IllegalStateException("Session is not active: " + sessionId);
        }

        if (!session.getSecretToken().equals(secretToken)) {
            throw new IllegalArgumentException("Invalid session secret token");
        }

        Optional<SessionParticipant> existingParticipant = participantRepository.findBySessionIdAndUserId(sessionId, user.getId());

        if (existingParticipant.isPresent()) {
            SessionParticipant participant = existingParticipant.get();
            participant.setStatus("ONLINE");
            return participantRepository.save(participant);
        } else {
            SessionParticipant participant = SessionParticipant.builder()
                    .session(session)
                    .user(user)
                    .role("EDITOR")
                    .status("ONLINE")
                    .permissionLevel("READ_WRITE")
                    .build();

            return participantRepository.save(participant);
        }
    }

    @Transactional
    public void updateParticipantStatus(String sessionId, Long userId, String status) {
        participantRepository.findBySessionIdAndUserId(sessionId, userId).ifPresent(p -> {
            p.setStatus(status);
            participantRepository.save(p);
        });
    }

    @Transactional
    public void updateParticipantRole(String sessionId, Long userId, String role) {
        participantRepository.findBySessionIdAndUserId(sessionId, userId).ifPresent(p -> {
            p.setRole(role);
            if ("HOST".equals(role)) {
                p.setPermissionLevel("ADMIN");
            } else if ("EDITOR".equals(role)) {
                p.setPermissionLevel("READ_WRITE");
            } else {
                p.setPermissionLevel("READ_ONLY");
            }
            participantRepository.save(p);
        });
    }

    @Transactional
    public void updateParticipantPermission(String sessionId, Long userId, String permission) {
        participantRepository.findBySessionIdAndUserId(sessionId, userId).ifPresent(p -> {
            p.setPermissionLevel(permission);
            participantRepository.save(p);
        });
    }

    public List<SessionParticipant> getActiveParticipants(String sessionId) {
        return participantRepository.findBySessionId(sessionId).stream()
                .filter(p -> "ONLINE".equals(p.getStatus()))
                .toList();
    }

    public List<SessionParticipant> getAllParticipants(String sessionId) {
        return participantRepository.findBySessionId(sessionId);
    }

    public List<CollaborationSession> getRecentSessionsForUser(Long userId) {
        // Find all sessions where this user is a participant
        return participantRepository.findByUserId(userId).stream()
                .map(SessionParticipant::getSession)
                .toList();
    }

    public Optional<CollaborationSession> getSession(String sessionId) {
        return sessionRepository.findById(sessionId);
    }

    @Transactional
    public void closeSession(String sessionId, Long hostId) {
        CollaborationSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new IllegalArgumentException("Session not found: " + sessionId));

        if (!session.getHost().getId().equals(hostId)) {
            throw new SecurityException("Only host can close the session");
        }

        session.setActive(false);
        sessionRepository.save(session);

        // Update all participants' status to OFFLINE
        participantRepository.findBySessionId(sessionId).forEach(p -> {
            p.setStatus("OFFLINE");
            participantRepository.save(p);
        });
    }
}
