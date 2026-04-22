package service

import (
	"context"

	"clinical-backend/internal/store"
)

type PlatformSettingsService struct {
	repo store.PlatformSettingsRepository
}

func NewPlatformSettingsService(repo store.PlatformSettingsRepository) *PlatformSettingsService {
	return &PlatformSettingsService{repo: repo}
}

func (s *PlatformSettingsService) GetSettings(ctx context.Context) (store.PlatformSettings, error) {
	return s.repo.GetSettings(ctx)
}

func (s *PlatformSettingsService) UpdateSettings(ctx context.Context, settings store.PlatformSettings) error {
	return s.repo.UpdateSettings(ctx, settings)
}
