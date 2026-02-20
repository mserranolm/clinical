package api

import (
	"context"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

var s3Client *s3.Client

func getS3Client(ctx context.Context) *s3.Client {
	if s3Client != nil {
		return s3Client
	}
	cfg, err := awsconfig.LoadDefaultConfig(ctx)
	if err != nil {
		log.Printf("[images] failed to load AWS config: %v", err)
		return nil
	}
	s3Client = s3.NewFromConfig(cfg)
	return s3Client
}

func (r *Router) getAppointmentUploadURL(ctx context.Context, appointmentID string, req events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	bucket := os.Getenv("IMAGES_BUCKET")
	if bucket == "" {
		return response(500, map[string]string{"error": "images bucket not configured"})
	}

	filename := req.QueryStringParameters["filename"]
	if filename == "" {
		filename = "image.jpg"
	}
	filename = sanitizeFilename(filename)

	contentType := req.QueryStringParameters["contentType"]
	if contentType == "" {
		contentType = "image/jpeg"
	}
	if !isAllowedContentType(contentType) {
		return response(400, map[string]string{"error": "tipo de archivo no permitido, usa JPEG o PNG"})
	}

	key := fmt.Sprintf("appointments/%s/%d-%s", appointmentID, time.Now().UnixMilli(), filename)

	client := getS3Client(ctx)
	if client == nil {
		return response(500, map[string]string{"error": "s3 client unavailable"})
	}

	presigner := s3.NewPresignClient(client)
	presigned, err := presigner.PresignPutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(bucket),
		Key:         aws.String(key),
		ContentType: aws.String(contentType),
	}, s3.WithPresignExpires(10*time.Minute))
	if err != nil {
		log.Printf("[images] presign error: %v", err)
		return response(500, map[string]string{"error": "no se pudo generar URL de subida"})
	}

	imageURL := fmt.Sprintf("https://%s.s3.amazonaws.com/%s", bucket, key)

	return response(200, map[string]string{
		"uploadUrl": presigned.URL,
		"key":       key,
		"imageUrl":  imageURL,
	})
}

func sanitizeFilename(name string) string {
	name = strings.ToLower(name)
	var safe strings.Builder
	for _, c := range name {
		if (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '.' || c == '-' || c == '_' {
			safe.WriteRune(c)
		} else {
			safe.WriteRune('-')
		}
	}
	s := safe.String()
	if len(s) > 80 {
		s = s[:80]
	}
	return s
}

func isAllowedContentType(ct string) bool {
	allowed := []string{"image/jpeg", "image/jpg", "image/png", "image/webp"}
	for _, a := range allowed {
		if ct == a {
			return true
		}
	}
	return false
}
