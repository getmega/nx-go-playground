package main

import (
	"getmega.com/libs/mcore"
	"fmt"
)

func Hello(name string) string {
	result := "Hello " + mcore.Mcore(name)
	return result
}

func main() {
	fmt.Println(Hello("mapi"))
}
