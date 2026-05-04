package util

import (
	"fmt"
	"time"
)

// FormatHora convierte time.Time a "8:00 a.m." / "2:30 p.m." en la zona horaria dada.
func FormatHora(t time.Time, loc *time.Location) string {
	local := t.In(loc)
	h := local.Hour()
	m := local.Minute()
	period := "a.m."
	if h >= 12 {
		period = "p.m."
	}
	h12 := h % 12
	if h12 == 0 {
		h12 = 12
	}
	return fmt.Sprintf("%d:%02d %s", h12, m, period)
}
