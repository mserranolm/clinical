package service

import (
	"fmt"
	"time"
)

func buildID(prefix string) string {
	return fmt.Sprintf("%s_%d", prefix, time.Now().UTC().UnixNano())
}
