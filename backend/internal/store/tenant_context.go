package store

import "context"

type orgIDCtxKey string

const ctxOrgIDKey orgIDCtxKey = "orgId"

func ContextWithOrgID(ctx context.Context, orgID string) context.Context {
	return context.WithValue(ctx, ctxOrgIDKey, orgID)
}

func OrgIDFromContext(ctx context.Context) string {
	v := ctx.Value(ctxOrgIDKey)
	if v == nil {
		return ""
	}
	orgID, _ := v.(string)
	return orgID
}
