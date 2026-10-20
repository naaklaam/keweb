package scanner

import (
	"fmt"
	"io"
)

// FlacStreamInfo contains exact audio properties extracted from the 34-byte FLAC STREAMINFO metadata block.
type FlacStreamInfo struct {
	SampleRate    int
	Channels      int
	BitsPerSample int
	Duration      float64
	TotalSamples  int64
}

// ParseFlacStreamInfo parses the FLAC header and STREAMINFO block.
func ParseFlacStreamInfo(r io.ReaderAt) (*FlacStreamInfo, error) {
	buf := make([]byte, 42)
	if _, err := r.ReadAt(buf, 0); err != nil {
		return nil, err
	}
	if string(buf[0:4]) != "fLaC" {
		return nil, fmt.Errorf("not a flac file")
	}

	// STREAMINFO starts at byte 8 (after 4 byte fLaC marker + 4 byte block header)
	// Audio properties are stored in bytes 18..25 (offset 10..17 inside STREAMINFO)
	b := buf[18:26]
	sampleRate := int(b[0])<<12 | int(b[1])<<4 | int(b[2])>>4
	channels := int((b[2]>>1)&0x07) + 1
	bitsPerSample := int((b[2]&0x01)<<4|(b[3]>>4)) + 1
	totalSamples := int64(b[3]&0x0F)<<32 |
		int64(b[4])<<24 |
		int64(b[5])<<16 |
		int64(b[6])<<8 |
		int64(b[7])

	var duration float64
	if sampleRate > 0 {
		duration = float64(totalSamples) / float64(sampleRate)
	}

	return &FlacStreamInfo{
		SampleRate:    sampleRate,
		Channels:      channels,
		BitsPerSample: bitsPerSample,
		Duration:      duration,
		TotalSamples:  totalSamples,
	}, nil
}
