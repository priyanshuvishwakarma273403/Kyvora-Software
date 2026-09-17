package com.kyvora.backend.controller;

import com.kyvora.backend.service.McpGatewayService;
import lombok.Data;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/ai/mcp")
public class McpGatewayController {

    private final McpGatewayService mcpGatewayService;

    public McpGatewayController(McpGatewayService mcpGatewayService) {
        this.mcpGatewayService = mcpGatewayService;
    }

    @Data
    public static class McpToolRequest {
        private String serverName;
        private String toolName;
        private Map<String, Object> arguments;
    }

    @PostMapping("/tool")
    public ResponseEntity<?> callMcpTool(@RequestBody McpToolRequest request) {
        try {
            Map<String, Object> result = mcpGatewayService.callTool(
                    request.getServerName(),
                    request.getToolName(),
                    request.getArguments()
            );
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of(
                    "status", "FAILED",
                    "error", e.getMessage()
            ));
        }
    }
}
