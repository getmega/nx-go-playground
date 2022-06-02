package main

import (
	"fmt"
	"github.com/nx-go-playground/mcore"
)

func Hello(name string) string {
	result := "Hello " + mcore.Mcore(name)
	return result
}

func main() {
	fmt.Println(Hello("mapi"))
}
