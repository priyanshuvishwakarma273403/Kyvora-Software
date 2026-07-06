package com.kyvora.backend.service;

import lombok.Builder;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
@Slf4j
public class RagVectorDbService {

    @Data
    @Builder
    public static class VectorNode {
        private String id;
        private String sourceName;
        private String chunkContent;
        private float[] embedding;
        private Map<String, Object> metadata;
        private LocalDateTime indexedAt;
    }

    @Data
    @Builder
    public static class RAGLog {
        private String id;
        private String message;
        private String level; // INFO, SUCCESS, WARN
        private LocalDateTime timestamp;
    }

    // In-memory Vector Store
    private final Map<String, VectorNode> vectorStore = new ConcurrentHashMap<>();
    private final List<RAGLog> logs = new CopyOnWriteArrayList<>();
    private static final int VECTOR_DIMENSION = 384;

    public RagVectorDbService() {
        addLog("RAG Vector Database initialized. In-memory mode active. Dimension: " + VECTOR_DIMENSION, "INFO");
        // Pre-populate with some beautiful mock data representing VS Code / Kyvora core code chunks
        seedSampleData();
    }

    public void addLog(String message, String level) {
        logs.add(RAGLog.builder()
                .id(UUID.randomUUID().toString())
                .message(message)
                .level(level)
                .timestamp(LocalDateTime.now())
                .build());
        if (logs.size() > 200) {
            logs.removeFirst(); // Keep logs memory bound
        }
        log.info("[RAG Log] [{}]: {}", level, message);
    }

    public List<RAGLog> getLogs() {
        return new ArrayList<>(logs);
    }

    public void clearStore() {
        vectorStore.clear();
        addLog("Vector database cleared successfully.", "WARN");
    }

    public Map<String, Object> getStats() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("totalVectors", vectorStore.size());
        stats.put("vectorDimension", VECTOR_DIMENSION);
        
        long docCount = vectorStore.values().stream()
                .map(VectorNode::getSourceName)
                .distinct()
                .count();
        stats.put("totalDocuments", docCount);
        stats.put("indexedFiles", vectorStore.values().stream()
                .map(VectorNode::getSourceName)
                .distinct()
                .collect(Collectors.toList()));
        stats.put("status", "HEALTHY");
        return stats;
    }

    /**
     * Splits code or text file into smaller chunks, generates embeddings, and saves them.
     */
    public int indexFile(String filename, String content) {
        addLog("Starting indexing for file: " + filename + " (size: " + content.length() + " chars)", "INFO");
        
        // Chunking strategy: 300 characters overlap chunking or line-based chunking
        List<String> chunks = chunkText(content, 400, 100);
        addLog("Generated " + chunks.size() + " text chunks for: " + filename, "INFO");

        int count = 0;
        for (int i = 0; i < chunks.size(); i++) {
            String chunk = chunks.get(i);
            float[] embedding = generateLocalEmbedding(chunk);
            
            String id = filename + "_chunk_" + i;
            Map<String, Object> metadata = new HashMap<>();
            metadata.put("chunkIndex", i);
            metadata.put("totalChunks", chunks.size());
            metadata.put("charLength", chunk.length());

            VectorNode node = VectorNode.builder()
                    .id(id)
                    .sourceName(filename)
                    .chunkContent(chunk)
                    .embedding(embedding)
                    .metadata(metadata)
                    .indexedAt(LocalDateTime.now())
                    .build();

            vectorStore.put(id, node);
            count++;
        }
        addLog("Successfully indexed " + count + " embeddings into Vector DB for: " + filename, "SUCCESS");
        return count;
    }

    /**
     * Similarity Search / Vector Search
     */
    public List<Map<String, Object>> search(String query, int limit) {
        addLog("Vector search initiated for query: \"" + query + "\"", "INFO");
        float[] queryEmbedding = generateLocalEmbedding(query);

        List<Map<String, Object>> results = new ArrayList<>();
        
        for (VectorNode node : vectorStore.values()) {
            double score = cosineSimilarity(queryEmbedding, node.getEmbedding());
            
            Map<String, Object> result = new HashMap<>();
            result.put("id", node.getId());
            result.put("sourceName", node.getSourceName());
            result.put("chunkContent", node.getChunkContent());
            result.put("score", score);
            result.put("metadata", node.getMetadata());
            result.put("indexedAt", node.getIndexedAt().toString());
            
            results.add(result);
        }

        // Sort by score descending
        results.sort((a, b) -> Double.compare((Double) b.get("score"), (Double) a.get("score")));

        List<Map<String, Object>> limitedResults = results.stream().limit(limit).collect(Collectors.toList());
        addLog("Search completed. Found " + limitedResults.size() + " matches. Top score: " + 
                (limitedResults.isEmpty() ? "N/A" : String.format("%.4f", limitedResults.getFirst().get("score"))), "SUCCESS");
        
        return limitedResults;
    }

    /**
     * Helper to split text into chunks with overlap
     */
    private List<String> chunkText(String text, int chunkSize, int overlap) {
        List<String> chunks = new ArrayList<>();
        if (text == null || text.trim().isEmpty()) {
            return chunks;
        }

        int start = 0;
        while (start < text.length()) {
            int end = Math.min(start + chunkSize, text.length());
            chunks.add(text.substring(start, end));
            if (end == text.length()) {
                break;
            }
            start += (chunkSize - overlap);
        }
        return chunks;
    }

    /**
     * Generates a high-quality, normalized deterministic pseudo-embedding (384 dimension) locally.
     * Maps word frequencies & character n-grams to a high-dimensional space.
     * This mimics the behaviour of standard text embeddings without requiring external LLM API calls.
     */
    private float[] generateLocalEmbedding(String text) {
        float[] vector = new float[VECTOR_DIMENSION];
        if (text == null || text.trim().isEmpty()) {
            return vector;
        }

        // Standardize input
        String normalized = text.toLowerCase();
        
        // Tokenize words
        String[] words = normalized.split("\\W+");
        
        // Populate vector bins using cryptographic hash projection
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            for (String word : words) {
                if (word.length() < 2) continue;
                
                // Get SHA-256 hash of the word
                byte[] hash = digest.digest(word.getBytes(StandardCharsets.UTF_8));
                
                // Project word into multiple dimensions (hash-trigrams projection)
                for (int i = 0; i < hash.length - 1; i += 2) {
                    int indexVal = ((hash[i] & 0xFF) << 8) | (hash[i+1] & 0xFF);
                    int dimensionIndex = Math.abs(indexVal) % VECTOR_DIMENSION;
                    
                    // Add word importance / weight
                    vector[dimensionIndex] += 1.5f;
                }
            }

            // Character n-grams (3-grams) projection to capture syntax details
            for (int i = 0; i < normalized.length() - 2; i++) {
                String trigram = normalized.substring(i, i + 3);
                byte[] hash = digest.digest(trigram.getBytes(StandardCharsets.UTF_8));
                int indexVal = ((hash[0] & 0xFF) << 8) | (hash[1] & 0xFF);
                int dimensionIndex = Math.abs(indexVal) % VECTOR_DIMENSION;
                vector[dimensionIndex] += 0.4f;
            }
            
        } catch (Exception e) {
            log.error("Failed to compute SHA-256 hash for embedding", e);
        }

        // Normalize vector to unit length (L2 Normalization)
        double magnitudeSum = 0;
        for (float val : vector) {
            magnitudeSum += val * val;
        }
        double magnitude = Math.sqrt(magnitudeSum);

        if (magnitude > 0) {
            for (int i = 0; i < VECTOR_DIMENSION; i++) {
                vector[i] /= magnitude;
            }
        }

        return vector;
    }

    private double cosineSimilarity(float[] vectorA, float[] vectorB) {
        if (vectorA == null || vectorB == null || vectorA.length != vectorB.length) {
            return 0.0;
        }
        double dotProduct = 0.0;
        double normA = 0.0;
        double normB = 0.0;
        for (int i = 0; i < vectorA.length; i++) {
            dotProduct += vectorA[i] * vectorB[i];
            normA += vectorA[i] * vectorA[i];
            normB += vectorB[i] * vectorB[i];
        }
        if (normA == 0.0 || normB == 0.0) {
            return 0.0;
        }
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    private void seedSampleData() {
        String code1 = """
                package com.kyvora.backend.security;
                
                import org.springframework.context.annotation.Bean;
                import org.springframework.security.config.annotation.web.builders.HttpSecurity;
                import org.springframework.security.web.SecurityFilterChain;
                
                public class WebSecurityConfig {
                    @Bean
                    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
                        http.cors().and().csrf().disable()
                            .authorizeHttpRequests()
                            .requestMatchers("/api/v1/auth/**").permitAll()
                            .anyRequest().authenticated();
                        return http.build();
                    }
                }
                """;

        String code2 = """
                import { useEffect, useState } from "react";
                import { io, Socket } from "socket.io-client";
                
                export function useCollaboration(sessionId: string) {
                    const [socket, setSocket] = useState<Socket | null>(null);
                    const [participants, setParticipants] = useState<string[]>([]);
                    
                    useEffect(() => {
                        const newSocket = io("http://localhost:8080/ws-collaboration");
                        newSocket.emit("join-session", { sessionId });
                        newSocket.on("update-participants", (list) => setParticipants(list));
                        setSocket(newSocket);
                        return () => newSocket.disconnect();
                    }, [sessionId]);
                    
                    return { socket, participants };
                }
                """;

        String code3 = """
                package com.kyvora.backend.controller;
                
                import com.kyvora.backend.service.CollaborationSessionService;
                import org.springframework.web.bind.annotation.*;
                
                @RestController
                @RequestMapping("/api/v1/collaboration")
                public class CollaborationController {
                    private final CollaborationSessionService service;
                    
                    @PostMapping("/create")
                    public ResponseEntity<?> createSession(@RequestParam String name) {
                        return ResponseEntity.ok(service.createSession(name));
                    }
                }
                """;

        indexFile("WebSecurityConfig.java", code1);
        indexFile("useCollaboration.ts", code2);
        indexFile("CollaborationController.java", code3);
        
        addLog("Seeded vector store with sample file chunks.", "SUCCESS");
    }
}
