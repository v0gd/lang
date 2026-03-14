package telemetry

import (
	"fmt"
	"log/slog"
	"sync/atomic"
	"time"
)

var traceId atomic.Int64

type Trace struct {
	name      string
	startTime time.Time
	traceId   uint64
}

func NewTrace(name string) *Trace {
	traceId := traceId.Add(1)
	slog.Info(fmt.Sprintf("%s started [traceId=%d]", name, traceId))
	return &Trace{
		name:      name,
		startTime: time.Now(),
		traceId:   uint64(traceId),
	}
}

func (t *Trace) Stop() {
	duration := time.Since(t.startTime)
	slog.Info(
		fmt.Sprintf("%s stopped [traceId=%d][t=%dms]", t.name, t.traceId, duration.Milliseconds()))
}
