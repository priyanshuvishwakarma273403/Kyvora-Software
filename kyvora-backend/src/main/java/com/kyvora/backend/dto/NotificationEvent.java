package com.kyvora.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NotificationEvent {
    private String type; // e.g. LOGIN, SIGNUP, SESSION_CREATED
    private String client; // e.g. vscode, web
    private String username;
    private String email;
    private String message;
    private long timestamp;
}
