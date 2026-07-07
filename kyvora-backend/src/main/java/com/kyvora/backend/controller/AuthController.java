package com.kyvora.backend.controller;

import com.kyvora.backend.dto.*;
import com.kyvora.backend.model.RefreshToken;
import com.kyvora.backend.model.User;
import com.kyvora.backend.repository.UserRepository;
import com.kyvora.backend.security.JwtUtils;
import com.kyvora.backend.security.UserDetailsImpl;
import com.kyvora.backend.service.RefreshTokenService;
import com.kyvora.backend.kafka.KafkaEventProducer;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
    private final AuthenticationManager authenticationManager;
    private final UserRepository userRepository;
    private final PasswordEncoder encoder;
    private final JwtUtils jwtUtils;
    private final RefreshTokenService refreshTokenService;
    private final KafkaEventProducer kafkaEventProducer;

    public AuthController(AuthenticationManager authenticationManager, UserRepository userRepository,
                          PasswordEncoder encoder, JwtUtils jwtUtils, RefreshTokenService refreshTokenService,
                          KafkaEventProducer kafkaEventProducer) {
        this.authenticationManager = authenticationManager;
        this.userRepository = userRepository;
        this.encoder = encoder;
        this.jwtUtils = jwtUtils;
        this.refreshTokenService = refreshTokenService;
        this.kafkaEventProducer = kafkaEventProducer;
    }

    @PostMapping("/login")
    public ResponseEntity<?> authenticateUser(
            @Valid @RequestBody LoginRequest loginRequest,
            @RequestHeader(value = "X-Client-Type", required = false) String clientHeader,
            @RequestHeader(value = "User-Agent", required = false) String userAgent) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(loginRequest.getUsername(), loginRequest.getPassword()));

        SecurityContextHolder.getContext().setAuthentication(authentication);
        UserDetailsImpl userDetails = (UserDetailsImpl) authentication.getPrincipal();

        String jwt = jwtUtils.generateJwtToken(userDetails.getUsername());
        
        // Remove existing refresh tokens before creating new one
        refreshTokenService.deleteByUserId(userDetails.getId());
        RefreshToken refreshToken = refreshTokenService.createRefreshToken(userDetails.getId());

        String role = userDetails.getAuthorities().stream()
                .findFirst()
                .map(item -> item.getAuthority().replace("ROLE_", ""))
                .orElse("USER");

        // Determine client type (vscode or web)
        String client = "web";
        if ("vscode".equalsIgnoreCase(clientHeader) || 
            (userAgent != null && userAgent.toLowerCase().contains("vscode"))) {
            client = "vscode";
        }

        // Produce a security notification event to Kafka
        NotificationEvent loginEvent = NotificationEvent.builder()
                .type("USER_LOGIN")
                .client(client)
                .username(userDetails.getUsername())
                .email(userDetails.getEmail())
                .message("User logged in successfully from " + client.toUpperCase() + " client.")
                .timestamp(System.currentTimeMillis())
                .build();
        kafkaEventProducer.sendNotification(loginEvent);

        return ResponseEntity.ok(new JwtResponse(jwt,
                refreshToken.getToken(),
                userDetails.getId(),
                userDetails.getUsername(),
                userDetails.getEmail(),
                role));
    }

    @PostMapping("/signup")
    public ResponseEntity<?> registerUser(@Valid @RequestBody SignupRequest signUpRequest) {
        if (userRepository.existsByUsername(signUpRequest.getUsername())) {
            return ResponseEntity
                    .badRequest()
                    .body(new MessageResponse("Error: Username is already taken!"));
        }

        if (userRepository.existsByEmail(signUpRequest.getEmail())) {
            return ResponseEntity
                    .badRequest()
                    .body(new MessageResponse("Error: Email is already in use!"));
        }

        String roleStr = signUpRequest.getRole();
        if (roleStr == null || roleStr.trim().isEmpty()) {
            roleStr = "USER";
        } else {
            roleStr = roleStr.trim().toUpperCase();
            if (!"ADMIN".equals(roleStr) && !"USER".equals(roleStr) && !"EDITOR".equals(roleStr)) {
                roleStr = "USER";
            }
        }

        // Create new user
        User user = User.builder()
                .username(signUpRequest.getUsername())
                .email(signUpRequest.getEmail())
                .password(encoder.encode(signUpRequest.getPassword()))
                .role(roleStr)
                .build();

        userRepository.save(user);

        // Produce signup event to Kafka
        NotificationEvent signupEvent = NotificationEvent.builder()
                .type("USER_SIGNUP")
                .client("web")
                .username(user.getUsername())
                .email(user.getEmail())
                .message("New user registered successfully with role: " + roleStr)
                .timestamp(System.currentTimeMillis())
                .build();
        kafkaEventProducer.sendNotification(signupEvent);

        return ResponseEntity.ok(new MessageResponse("User registered successfully!"));
    }

    @PostMapping("/refreshtoken")
    public ResponseEntity<?> refreshtoken(@Valid @RequestBody TokenRefreshRequest request) {
        String requestRefreshToken = request.getRefreshToken();

        return refreshTokenService.findByToken(requestRefreshToken)
                .map(refreshTokenService::verifyExpiration)
                .map(RefreshToken::getUser)
                .map(user -> {
                    String token = jwtUtils.generateJwtToken(user.getUsername());
                    return ResponseEntity.ok(new TokenRefreshResponse(token, requestRefreshToken));
                })
                .orElseThrow(() -> new RuntimeException("Refresh token is not in database!"));
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logoutUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof UserDetailsImpl userDetails) {
            refreshTokenService.deleteByUserId(userDetails.getId());
        }
        return ResponseEntity.ok(new MessageResponse("Log out successful!"));
    }
}
