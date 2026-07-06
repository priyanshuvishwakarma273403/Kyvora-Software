package com.kyvora.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.concurrent.TimeUnit;

@Service
@Slf4j
public class RedisPresenceService {
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    public RedisPresenceService(StringRedisTemplate redisTemplate, ObjectMapper objectMapper) {
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
    }

    @Data
    public static class UserPresence {
        private String userId;
        private String username;
        private String status; // ONLINE, AWAY, OFFLINE
        private String activeFile;
        private int cursorLine;
        private int cursorColumn;
        private String selection; // Selection range representation
        private boolean voiceMuted;
        private long lastActive;
    }

    public void updateUserPresence(String sessionId, UserPresence presence) {
        String key = String.format("kyvora:session:%s:user:%s:presence", sessionId, presence.getUserId());
        try {
            presence.setLastActive(System.currentTimeMillis());
            String val = objectMapper.writeValueAsString(presence);
            redisTemplate.opsForValue().set(key, val, 10, TimeUnit.MINUTES); // 10 minutes expiry
        } catch (Exception e) {
            log.error("Failed to update presence in Redis: {}", e.getMessage());
        }
    }

    public void removeUserPresence(String sessionId, String userId) {
        String key = String.format("kyvora:session:%s:user:%s:presence", sessionId, userId);
        redisTemplate.delete(key);
    }

    public List<UserPresence> getSessionPresence(String sessionId) {
        String pattern = String.format("kyvora:session:%s:user:*:presence", sessionId);
        Set<String> keys = redisTemplate.keys(pattern);
        List<UserPresence> list = new ArrayList<>();

        if (keys != null) {
            for (String key : keys) {
                String val = redisTemplate.opsForValue().get(key);
                if (val != null) {
                    try {
                        UserPresence presence = objectMapper.readValue(val, UserPresence.class);
                        list.add(presence);
                    } catch (Exception e) {
                        log.error("Error reading presence from Redis: {}", e.getMessage());
                    }
                }
            }
        }
        return list;
    }
}
