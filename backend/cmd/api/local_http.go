package main

import (
	"context"
	"io"
	"log"
	"net/http"
	"os"

	"clinical-backend/internal/api"

	"github.com/aws/aws-lambda-go/events"
)

func runLocalHTTP(router *api.Router) error {
	port := os.Getenv("LOCAL_HTTP_PORT")
	if port == "" {
		port = "3000"
	}

	handler := func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		defer r.Body.Close()

		headers := map[string]string{}
		for key, values := range r.Header {
			if len(values) > 0 {
				headers[key] = values[0]
			}
		}

		query := map[string]string{}
		for key, values := range r.URL.Query() {
			if len(values) > 0 {
				query[key] = values[0]
			}
		}

		lambdaReq := events.APIGatewayV2HTTPRequest{
			RawPath:               r.URL.Path,
			Body:                  string(body),
			Headers:               headers,
			QueryStringParameters: query,
			RequestContext: events.APIGatewayV2HTTPRequestContext{
				HTTP: events.APIGatewayV2HTTPRequestContextHTTPDescription{
					Method: r.Method,
					Path:   r.URL.Path,
				},
			},
		}

		resp, err := router.Handle(context.Background(), lambdaReq)
		if err != nil {
			log.Printf("local request failed: %v", err)
			w.WriteHeader(http.StatusInternalServerError)
			_, _ = w.Write([]byte(`{"error":"internal_error"}`))
			return
		}

		for key, value := range resp.Headers {
			w.Header().Set(key, value)
		}
		w.WriteHeader(resp.StatusCode)
		_, _ = w.Write([]byte(resp.Body))
	}

	log.Printf("local http server listening on :%s", port)
	return http.ListenAndServe(":"+port, http.HandlerFunc(handler))
}
