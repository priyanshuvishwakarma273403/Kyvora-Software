package com.kyvora.backend.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class KyvoraState {
    private String threadId;
    private String checkpointId;
    private String userPrompt;
    
    @Builder.Default
    private List<String> planSteps = new ArrayList<>();
    
    @Builder.Default
    private int currentStepIndex = 0;
    
    @Builder.Default
    private Map<String, Map<String, String>> workspaceFiles = new HashMap<>();
    
    @Builder.Default
    private List<String> compilationErrors = new ArrayList<>();
    
    @Builder.Default
    private Map<String, Object> testResults = new HashMap<>();
    
    @Builder.Default
    private List<Map<String, Object>> executionHistory = new ArrayList<>();
    
    @Builder.Default
    private boolean isApproved = false;
    
    @Builder.Default
    private int failoverCount = 0;
    
    public void appendHistory(String agentId, String thought, String tool, Map<String, Object> arguments, String output) {
        Map<String, Object> step = new HashMap<>();
        step.put("agentId", agentId);
        step.put("thought", thought);
        step.put("toolCalled", tool);
        step.put("arguments", arguments);
        step.put("toolOutput", output);
        step.put("timestamp", System.currentTimeMillis());
        this.executionHistory.add(step);
    }
}
