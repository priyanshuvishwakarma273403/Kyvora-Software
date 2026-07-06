package com.kyvora.backend.controller;

import com.kyvora.backend.service.RagVectorDbService;
import lombok.Data;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/rag")
@CrossOrigin(origins = "*")
public class RagController {

    private final RagVectorDbService ragVectorDbService;

    public RagController(RagVectorDbService ragVectorDbService) {
        this.ragVectorDbService = ragVectorDbService;
    }

    @Data
    public static class IndexRequest {
        private String filename;
        private String content;
    }

    @Data
    public static class SearchRequest {
        private String query;
        private int limit = 3;
    }

    @PostMapping("/index")
    public ResponseEntity<?> indexFile(@RequestBody IndexRequest request) {
        try {
            if (request.getFilename() == null || request.getFilename().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Filename is required"));
            }
            if (request.getContent() == null || request.getContent().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Content is required"));
            }
            int count = ragVectorDbService.indexFile(request.getFilename(), request.getContent());
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Successfully indexed file",
                    "chunksCreated", count
            ));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/search")
    public ResponseEntity<?> search(@RequestBody SearchRequest request) {
        try {
            if (request.getQuery() == null || request.getQuery().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Query is required"));
            }
            return ResponseEntity.ok(ragVectorDbService.search(request.getQuery(), request.getLimit()));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/stats")
    public ResponseEntity<?> getStats() {
        return ResponseEntity.ok(ragVectorDbService.getStats());
    }

    @GetMapping("/logs")
    public ResponseEntity<?> getLogs() {
        return ResponseEntity.ok(ragVectorDbService.getLogs());
    }

    @PostMapping("/clear")
    public ResponseEntity<?> clear() {
        ragVectorDbService.clearStore();
        return ResponseEntity.ok(Map.of("success", true, "message", "Vector database cleared"));
    }
}
