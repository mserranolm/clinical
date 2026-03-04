GOOS=linux
GOARCH=arm64
CGO_ENABLED=0

.PHONY: build-ClinicalApiFunction build-Reminder24hFunction build-EndOfDayFunction build test lint clean local

# SAM build targets (all produce the same bootstrap binary for Lambda)
build-ClinicalApiFunction build-Reminder24hFunction build-EndOfDayFunction:
	GOOS=$(GOOS) GOARCH=$(GOARCH) CGO_ENABLED=$(CGO_ENABLED) go build -o $(ARTIFACTS_DIR)/bootstrap ./cmd/api

# Local development build (host architecture)
build:
	go build -o api ./cmd/api

# Run all tests
test:
	go test ./...

# Run linter (requires golangci-lint)
lint:
	golangci-lint run ./...

# Remove local build artifacts
clean:
	rm -f api bootstrap

# Start local HTTP server (requires SAM CLI or local env vars)
local:
	go run ./cmd/api
