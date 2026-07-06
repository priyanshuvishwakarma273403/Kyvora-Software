package com.kyvora.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CollaborationEvent {
    private String type; // e.g. CURSOR_MOVE, FILE_EDIT, CHAT_MESSAGE, etc.
    private String sessionId;
    private String userId;
    private String username;
    private String payload; // JSON serialized specific action payload
    private long timestamp;
}
