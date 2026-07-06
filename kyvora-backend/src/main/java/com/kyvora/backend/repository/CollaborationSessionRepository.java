package com.kyvora.backend.repository;

import com.kyvora.backend.model.CollaborationSession;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface CollaborationSessionRepository extends JpaRepository<CollaborationSession, String> {
    List<CollaborationSession> findByActive(boolean active);
    List<CollaborationSession> findByHostId(Long hostId);
}
