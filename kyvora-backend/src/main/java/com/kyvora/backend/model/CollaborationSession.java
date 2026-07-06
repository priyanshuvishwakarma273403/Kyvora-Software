package com.kyvora.backend.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "collaboration_sessions")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CollaborationSession {
    @Id
    @Column(length = 50)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "host_id", nullable = false)
    @JsonIgnore
    private User host;

    @Column(nullable = false, length = 100)
    private String title;

    @Builder.Default
    private boolean active = true;

    @Column(name = "secret_token", nullable = false)
    private String secretToken;

    @Column(name = "created_at", updatable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
