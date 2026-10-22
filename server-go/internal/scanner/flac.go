package scanner

import (
	"encoding/binary"
	"fmt"
	"io"
	"os"
	"strings"
)

// FlacStreamInfo contains exact audio properties extracted from the 34-byte FLAC STREAMINFO metadata block.
type FlacStreamInfo struct {
	SampleRate    int
	Channels      int
	BitsPerSample int
	Duration      float64
	TotalSamples  int64
}

// FlacMetadata holds STREAMINFO, all Vorbis comments, and embedded picture.
type FlacMetadata struct {
	StreamInfo  FlacStreamInfo
	Comments    map[string][]string // Case-insensitive normalized (uppercase keys)
	PictureData []byte
	PictureMime string
}

// FirstComment returns the first value for a comment key, trimmed, or empty string.
func (m *FlacMetadata) FirstComment(key string) string {
	if m == nil || m.Comments == nil {
		return ""
	}
	vals := m.Comments[strings.ToUpper(key)]
	if len(vals) > 0 {
		return strings.TrimSpace(vals[0])
	}
	return ""
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

// ParseFullFlacFile parses the entire metadata block chain (STREAMINFO, VORBIS_COMMENT, PICTURE) directly.
func ParseFullFlacFile(filePath string) (*FlacMetadata, error) {
	f, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	header := make([]byte, 4)
	if _, err := io.ReadFull(f, header); err != nil || string(header) != "fLaC" {
		return nil, fmt.Errorf("not a flac file")
	}

	meta := &FlacMetadata{
		Comments: make(map[string][]string),
	}

	bh := make([]byte, 4)
	for {
		if _, err := io.ReadFull(f, bh); err != nil {
			break
		}
		isLast := (bh[0] & 0x80) != 0
		btype := bh[0] & 0x7F
		length := int(bh[1])<<16 | int(bh[2])<<8 | int(bh[3])

		switch btype {
		case 0: // STREAMINFO (34 bytes)
			data := make([]byte, length)
			if _, err := io.ReadFull(f, data); err != nil {
				return nil, err
			}
			if length >= 24 {
				b := data[10:18]
				sampleRate := int(b[0])<<12 | int(b[1])<<4 | int(b[2])>>4
				channels := int((b[2]>>1)&0x07) + 1
				bitsPerSample := int((b[2]&0x01)<<4|(b[3]>>4)) + 1
				totalSamples := int64(b[3]&0x0F)<<32 |
					int64(b[4])<<24 |
					int64(b[5])<<16 |
					int64(b[6])<<8 |
					int64(b[7])
				var dur float64
				if sampleRate > 0 {
					dur = float64(totalSamples) / float64(sampleRate)
				}
				meta.StreamInfo = FlacStreamInfo{
					SampleRate:    sampleRate,
					Channels:      channels,
					BitsPerSample: bitsPerSample,
					Duration:      dur,
					TotalSamples:  totalSamples,
				}
			}

		case 4: // VORBIS_COMMENT
			data := make([]byte, length)
			if _, err := io.ReadFull(f, data); err != nil {
				return nil, err
			}
			if length >= 8 {
				vlen := int(binary.LittleEndian.Uint32(data[0:4]))
				pos := 4 + vlen
				if pos+4 <= length {
					count := int(binary.LittleEndian.Uint32(data[pos : pos+4]))
					pos += 4
					for i := 0; i < count; i++ {
						if pos+4 > length {
							break
						}
						commLen := int(binary.LittleEndian.Uint32(data[pos : pos+4]))
						pos += 4
						if pos+commLen > length {
							break
						}
						commStr := string(data[pos : pos+commLen])
						pos += commLen
						if eq := strings.IndexByte(commStr, '='); eq > 0 {
							k := strings.ToUpper(strings.TrimSpace(commStr[:eq]))
							v := strings.TrimSpace(commStr[eq+1:])
							meta.Comments[k] = append(meta.Comments[k], v)
						}
					}
				}
			}

		case 6: // PICTURE
			// If we haven't stored a picture yet, read it
			if len(meta.PictureData) == 0 && length >= 32 {
				data := make([]byte, length)
				if _, err := io.ReadFull(f, data); err != nil {
					return nil, err
				}
				pos := 4 // skip picture type
				mimeLen := int(binary.BigEndian.Uint32(data[pos : pos+4]))
				pos += 4
				if pos+mimeLen <= length {
					meta.PictureMime = string(data[pos : pos+mimeLen])
					pos += mimeLen
					descLen := int(binary.BigEndian.Uint32(data[pos : pos+4]))
					pos += 4 + descLen + 16 // skip desc + width/height/depth/colors
					if pos+4 <= length {
						picDataLen := int(binary.BigEndian.Uint32(data[pos : pos+4]))
						pos += 4
						if pos+picDataLen <= length {
							meta.PictureData = data[pos : pos+picDataLen]
						}
					}
				}
			} else {
				if _, err := f.Seek(int64(length), io.SeekCurrent); err != nil {
					return nil, err
				}
			}

		default:
			if _, err := f.Seek(int64(length), io.SeekCurrent); err != nil {
				return nil, err
			}
		}

		if isLast {
			break
		}
	}

	return meta, nil
}
