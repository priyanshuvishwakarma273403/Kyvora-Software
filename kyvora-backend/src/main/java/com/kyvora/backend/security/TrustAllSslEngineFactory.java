package com.kyvora.backend.security;

import org.apache.kafka.common.security.auth.SslEngineFactory;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLEngine;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;
import java.security.SecureRandom;
import java.security.cert.X509Certificate;
import java.security.KeyStore;
import java.util.Map;
import java.util.Set;
import java.util.Collections;

public class TrustAllSslEngineFactory implements SslEngineFactory {
    private SSLContext sslContext;

    @Override
    public void configure(Map<String, ?> configs) {
        try {
            sslContext = SSLContext.getInstance("TLS");
            sslContext.init(null, new TrustManager[]{new X509TrustManager() {
                public X509Certificate[] getAcceptedIssuers() {
                    return new X509Certificate[0];
                }
                public void checkClientTrusted(X509Certificate[] certs, String authType) {}
                public void checkServerTrusted(X509Certificate[] certs, String authType) {}
            }}, new SecureRandom());
        } catch (Exception e) {
            throw new RuntimeException("Failed to initialize TrustAllSslEngineFactory", e);
        }
    }

    @Override
    public SSLEngine createClientSslEngine(String peerHost, int peerPort, String endpointIdentificationAlgorithm) {
        SSLEngine engine = sslContext.createSSLEngine(peerHost, peerPort);
        engine.setUseClientMode(true);
        return engine;
    }

    @Override
    public SSLEngine createServerSslEngine(String peerHost, int peerPort) {
        SSLEngine engine = sslContext.createSSLEngine(peerHost, peerPort);
        engine.setUseClientMode(false);
        return engine;
    }

    @Override
    public KeyStore keystore() {
        return null;
    }

    @Override
    public KeyStore truststore() {
        return null;
    }

    @Override
    public boolean shouldBeRebuilt(Map<String, Object> nextConfigs) {
        return false;
    }

    @Override
    public Set<String> reconfigurableConfigs() {
        return Collections.emptySet();
    }

    @Override
    public void close() {}
}
