package com.kyvora.backend.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "session_participants", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"session_id", "user_id"})
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SessionParticipant {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id", nullable = false)
    @JsonIgnore
    private CollaborationSession session;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "joined_at", updatable = false)
    @Builder.Default
    private LocalDateTime joinedAt = LocalDateTime.now();

    @Column(nullable = false, length = 20)
    private String role; // HOST, EDITOR, VIEWER

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String status = "OFFLINE"; // ONLINE, OFFLINE, AWAY

    @Column(name = "permission_level", nullable = false, length = 20)
    @Builder.Default
    private String permissionLevel = "READ_WRITE"; // READ_ONLY, READ_WRITE, ADMIN
}
