package main

import (
	"fmt"
	"getmega.com/libs/core/bar"
	"getmega.com/libs/mcore"
)

func Hello(name string) string {
	result := "Helsdldlo " + mcore.Mcore(name) + bar.GetName()
	return result
}

func main() {
	fmt.Println(Hello("mapi"))
}
