package stringutil

import (
	"crypto/rand"
	"fmt"
	"math/big"
)

func IsAlphaNum(s string) bool {
	for _, c := range s {
		if (c < '0' || c > '9') && (c < 'A' || c > 'Z') && (c < 'a' || c > 'z') {
			return false
		}
	}
	return true
}

func IsAlphaNumOrSpace(s string) bool {
	for _, c := range s {
		if (c < '0' || c > '9') && (c < 'A' || c > 'Z') && (c < 'a' || c > 'z') && c != ' ' {
			return false
		}
	}
	return true
}

const (
	charset = "abcdefghijkmnpqrstuvwxyz23456789"
)

func RandomBase32(length int) string {
	var result string
	for i := 0; i < length; i++ {
		randomIndex, err := rand.Int(rand.Reader, big.NewInt(int64(len(charset))))
		if err != nil {
			panic(fmt.Sprintf("Failed to generate random number: %v", err))
		}
		result += string(charset[randomIndex.Int64()])
	}
	return result
}
