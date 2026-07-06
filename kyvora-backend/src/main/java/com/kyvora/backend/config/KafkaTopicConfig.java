package com.kyvora.backend.config;

import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;

@Configuration
public class KafkaTopicConfig {

    @Bean
    public NewTopic collaborationEventsTopic() {
        return TopicBuilder.name("kyvora-collaboration-events")
                .partitions(3)
                .replicas(1)
                .build();
    }

    @Bean
    public NewTopic chatEventsTopic() {
        return TopicBuilder.name("kyvora-chat-events")
                .partitions(3)
                .replicas(1)
                .build();
    }

    @Bean
    public NewTopic terminalEventsTopic() {
        return TopicBuilder.name("kyvora-terminal-events")
                .partitions(3)
                .replicas(1)
                .build();
    }
}
