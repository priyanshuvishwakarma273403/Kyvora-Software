package com.kyvora.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kyvora.backend.dto.UserProfileResponse;
import com.kyvora.backend.model.User;
import com.kyvora.backend.repository.UserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1")
@Slf4j
public class UserController {

    private final UserRepository userRepository;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;
    private static final String PROFILE_CACHE_KEY_PREFIX = "kyvora:user:profile:";

    public UserController(UserRepository userRepository, StringRedisTemplate redisTemplate, ObjectMapper objectMapper) {
        this.userRepository = userRepository;
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
    }

    @GetMapping("/users/profile")
    public ResponseEntity<?> getUserProfile() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        String username;
        if (principal instanceof UserDetails) {
            username = ((UserDetails) principal).getUsername();
        } else {
            username = principal.toString();
        }

        log.info("Fetching profile for user: {}", username);
        String cacheKey = PROFILE_CACHE_KEY_PREFIX + username;

        try {
            // 1. Try to fetch from Valkey Cache
            String cachedProfileJson = redisTemplate.opsForValue().get(cacheKey);
            if (cachedProfileJson != null) {
                log.info("Valkey Cache HIT for key: {}", cacheKey);
                UserProfileResponse response = objectMapper.readValue(cachedProfileJson, UserProfileResponse.class);
                response.setSource("Valkey Cache");
                return ResponseEntity.ok(response);
            }
        } catch (Exception e) {
            log.error("Failed to query Valkey cache: {}", e.getMessage());
        }

        // 2. Fetch from MySQL Database on cache miss
        log.info("Valkey Cache MISS for key: {}. Fetching from MySQL database...", cacheKey);
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found in MySQL: " + username));

        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
        String createdAtStr = user.getCreatedAt() != null ? user.getCreatedAt().format(formatter) : "N/A";

        UserProfileResponse dbResponse = UserProfileResponse.builder()
                .id(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .role(user.getRole())
                .createdAt(createdAtStr)
                .source("MySQL Database")
                .build();

        try {
            // 3. Cache the profile in Valkey with 60 seconds TTL (for demonstration of hit/miss transitions)
            String jsonToCache = objectMapper.writeValueAsString(dbResponse);
            redisTemplate.opsForValue().set(cacheKey, jsonToCache, 60, TimeUnit.SECONDS);
            log.info("Successfully cached profile in Valkey for 60 seconds. Key: {}", cacheKey);
        } catch (Exception e) {
            log.error("Failed to store profile in Valkey cache: {}", e.getMessage());
        }

        return ResponseEntity.ok(dbResponse);
    }

    // Role-based Access Control Demonstration: Restricted to ADMIN role
    @GetMapping("/admin/users")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<UserProfileResponse>> getAllUsers() {
        log.info("ADMIN request: Fetching all registered users from MySQL...");
        List<User> users = userRepository.findAll();
        
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
        List<UserProfileResponse> responses = users.stream()
                .map(user -> UserProfileResponse.builder()
                        .id(user.getId())
                        .username(user.getUsername())
                        .email(user.getEmail())
                        .role(user.getRole())
                        .createdAt(user.getCreatedAt() != null ? user.getCreatedAt().format(formatter) : "N/A")
                        .source("MySQL Database")
                        .build())
                .collect(Collectors.toList());

        return ResponseEntity.ok(responses);
    }
}
