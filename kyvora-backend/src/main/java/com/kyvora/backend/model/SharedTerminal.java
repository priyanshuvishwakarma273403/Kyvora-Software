package com.kyvora.backend.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "shared_terminals")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SharedTerminal {
    @Id
    @Column(length = 50)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id", nullable = false)
    private CollaborationSession session;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    @Builder.Default
    private boolean active = true;
}
