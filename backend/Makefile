GOOS=linux
GOARCH=arm64
CGO_ENABLED=0

.PHONY: build-ClinicalApiFunction build-Reminder24hFunction build-EndOfDayFunction

build-ClinicalApiFunction:
	GOOS=$(GOOS) GOARCH=$(GOARCH) CGO_ENABLED=$(CGO_ENABLED) go build -o $(ARTIFACTS_DIR)/bootstrap ./cmd/api

build-Reminder24hFunction:
	GOOS=$(GOOS) GOARCH=$(GOARCH) CGO_ENABLED=$(CGO_ENABLED) go build -o $(ARTIFACTS_DIR)/bootstrap ./cmd/api

build-EndOfDayFunction:
	GOOS=$(GOOS) GOARCH=$(GOARCH) CGO_ENABLED=$(CGO_ENABLED) go build -o $(ARTIFACTS_DIR)/bootstrap ./cmd/api
