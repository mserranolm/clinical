package util

import (
	"testing"
	"time"
)

func TestFormatHora(t *testing.T) {
	loc := time.UTC
	cases := []struct {
		h, m int
		want string
	}{
		{0, 0, "12:00 a.m."},
		{8, 0, "8:00 a.m."},
		{9, 30, "9:30 a.m."},
		{12, 0, "12:00 p.m."},
		{14, 30, "2:30 p.m."},
		{23, 59, "11:59 p.m."},
	}
	for _, c := range cases {
		ts := time.Date(2026, 1, 1, c.h, c.m, 0, 0, loc)
		got := FormatHora(ts, loc)
		if got != c.want {
			t.Errorf("FormatHora(%d:%02d) = %q, want %q", c.h, c.m, got, c.want)
		}
	}
}
