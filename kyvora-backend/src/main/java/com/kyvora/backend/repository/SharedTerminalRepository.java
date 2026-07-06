package com.kyvora.backend.repository;

import com.kyvora.backend.model.SharedTerminal;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface SharedTerminalRepository extends JpaRepository<SharedTerminal, String> {
    List<SharedTerminal> findBySessionId(String sessionId);
    List<SharedTerminal> findBySessionIdAndActiveTrue(String sessionId);
}
