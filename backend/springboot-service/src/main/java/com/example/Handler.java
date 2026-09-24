package com.example;

import com.amazonaws.serverless.exceptions.ContainerInitializationException;
import com.amazonaws.serverless.proxy.spring.SpringDelegatingLambdaContainerHandler;

/**
 * AWS Lambda entry point.
 *
 * Terraform wires every Java service in this repository to the handler
 * {@code com.example.Handler::handleRequest} (see infra/locals.tf), so this class name and package
 * are fixed. The inherited handleRequest method translates the Lambda event into a servlet request,
 * runs it through Spring MVC, and writes the servlet response back as the Lambda result. Both the
 * API Gateway v1 and the Function URL v2 payload formats are detected automatically.
 *
 * Passing the application class to super is not optional: the no-argument constructor instead looks
 * for a Start-Class manifest attribute, which the shade plugin does not write, and initialization
 * would fail.
 */
public class Handler extends SpringDelegatingLambdaContainerHandler {

    /**
     * Boots the Spring application context.
     *
     * Lambda constructs the handler once per execution environment, so the cost of starting Spring is
     * paid on cold start only and warm invocations reuse the running context.
     *
     * @throws ContainerInitializationException if the Spring context fails to start
     */
    public Handler() throws ContainerInitializationException {
        super(Application.class);
    }
}
