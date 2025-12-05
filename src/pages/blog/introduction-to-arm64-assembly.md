---
layout: '../../layouts/BlogLayout.astro'
title: 'Introduction to ARM64 Assembly'
description: 'Getting started with ARM64 assembly for apple silicon by building a simple calculator.'
date: 'December 5, 2025'
draft: false
---

Learning assembly language provides a window into how computers actually work. It improves your skills as a developer by revealing what high-level languages are doing behind the scenes, helping you to make better optimization decisions. In this blog post, we will dive into the fundamentals of ARM64 by building a simple calculator.

Assembly language instruction sets are different across CPU architectures. This blog focuses on the ARM64 instruction set for Apple Silicon, but the underline knowledge can be transferred to other ARM64 based devices.

> This blog post assumes you have some programming experience and a basic understanding of computer programing concepts.

##### Core Concepts

Before diving into assembly code, we need to learn about CPU registers. In ARM64, we have 3 types of registers.
- General Purpose Registers
- Floating Point Registers (including SIMD)
- Special Purpose Registers (SPRs)

The General Purpose Registers (GPRs) are divided into two categories:
- Extended Registers (64 bits): x0 to x30
- Non-Extended Registers (32 bits): w0 to w30

The extended registers and non-extended registers point to the same physical address in memory, but the w registers contain only the lower 32 bits of the x registers.

Using the LLDB debugger, we can inspect the current state of the x0 and w0 registers. They appear to contain the same value because w0 is simply a view of the lower 32 bits of x0.
```sh
(lldb) register read -f b x0
    x0 = 0b0000000000000000000000000000000000000000000000000000000000000110
(lldb) register read -f b w0
    w0 = 0b00000000000000000000000000000110
(lldb)
```
The Floating Point Registers (FPRs) are divided into three main categories:
- v0 to v31 for 128bit values
- do to d31 for 64bit values
- s0 to s31 for 32bit values

Special Purpose Registers (SPRs) include the Program Counter (PC), Stack Pointer (SP), and Link Register (LR).

The Stack pointer holds the memory address that points to the top of the stack.

There is a convention on how registers are to be used.
- **x0 - x8** registers are for passing and returning values from functions.
- **x9 - x15** are temporary registers. They can be used however you wish in a function.
- **x16** register is used for precedure calls by the compiler. Do not use them.
- **x18** register is used by the operation system. Do no use them.
- **x19 - x28** registers are temporary whose values must be preserved by the function. You have to store their intial values somewhere and restore the value when function is done.
- **x29** register is for the frame pointer.
- **x30** register is for the link register.

Now that we have covered the basics of ARM64 registers, we move on to the instruction sets. Assembly code instructions are executed from top to bottom.

Here is an example of an ARM64 assembly instruction set:
```asm
mov     x9, #17
mov     x10, #3
add     x11, x9, x10
```
The first **mov** instruction is storing the value 17 in x9 register. Registers can store immediate values (Immediate values are values that are stored directly in the register) or store a pointer to a location in memory. The second **mov** instruction stores the value 3 in the x10 register. The **add** instruction adds the values in the x9 and x10 registers and stores the result in the x11 register.

In most cases the destination register comes first, followed by the source registers. In the **add** instruction x11 is the destination register and x9 and x10 are the source registers.

##### Getting Command Line Arguments

The first step in building our calculator program is to get user input from the command line.

An example usage:
```sh
./calculate 2 + 3
```
The argument count is stored in x0 register and the argument values are stored in the x1 register.
```asm 
.global _main
.align 4

_main:
    cmp     x0, #4 // Check if the argc is equal to 4
    b.ne   _invalid_argument
   
    // First command line argument
    ldr     x10, [x1, #8]
    bl      _check_float_setup
    bl      _str_to_int
    mov     x11, x10
   
    // Third command line argument
    ldr     x10, [x1, #24]
    bl      _check_float_setup
    bl      _str_to_int
    mov     x12, x10
   
    // Second command line argument (operator)
    ldr     x10, [x1, #16]
    ldrb    w9, [x10
```
Lets break down what is going on the above in code snippet.
The **.global** directive is used to expose the **_main** function to the assembler - The assembler is used to convert the source code into an object file which then complied into an executable file by a linker. It denotes the entry point of the program.

the **.align** directive is used to align the code to a specific boundary - It ensures each block of data is divisible by a specified ammount. In this case, it is aligned to a 4bytes boundary.

The `cmp    x0, #4` instruction checks if the length of the command line arguments is equal to 4. If it is not, the program jumps to the **_invalid_argument** function.

The program name is the first command line argument, the second is the first number, third is the operator and the fourth is the second number. To get first number we need to move the x1 pointer by 8bytes and use the **ldr** instruction to load the value into the x10 register. We do the same for the operator and the second number, adding 8bytes each time to the x1 pointer.

We will talk about the below instructions in the next section.
```asm 
bl      _check_float_setup
bl      _str_to_int
```

##### String to Integer Conversion

Command line arguments are strings and we can not perform arithmetic operations on string. We need to convert the strings to integers. Before getting into that, lets talk about how functions work in assembly. Technically, they are more like labels not actual functions like in higher level languages, but for simplicity we will call them functions. 

The **bl** instruction tells the program to jump to the specified function and store the address of where it jumped from in the link register. This allows the program to return to the correct location after the function call.

The `bl      _check_float_setup` instruction tells the program to jump to the **_check_float_setup** function (the leading underscore is just a naming convention).
```asm
_check_float_setup:
    mov     x12, #0

_check_float:
    ldrb    w9, [x10, x12]
    cbz     w9, _return_check_float
    cmp     w9, #'.'
    b.eq    _no_float_support_error
    add     x12, x12, #1
    b       _check_float

_return_check_float:
    ret
```
The **_check_float_setup** setups our control variable by moving 0 to the x12 register. The reason assembly functions are more like labels is because without a **ret** or a **b** instruction the flow execution moves to the next function. This makes the code structure very important.

The **_check_float** function checks if the string contains a decimal point. If it does, it raises an error. If not, it returns.

The **_return_check_float** function returns from the **_check_float_setup** function. The next instruction is the `bl _str_to_int` instruction, which calls the **_str_to_int** function.

```asm 
_str_to_int:
    mov     x13, #0 
    mov     x14, #10 
    mov     x15, #0 // Sign flag (0 = +, 1 = -)
    
    ldrb    w9, [x10] // Load first byte
    cmp     w9, #45 
    b.ne    _int_convert_loop
    mov     x15, #1 
    add     x10, x10, #1 // Move the pointer to the next byte (Character)

_int_convert_loop:
    ldrb    w9, [x10], #1
    cbz     w9, _end_int_convert_loop
    sub     w9, w9, #48 // Subtract 48 from w9 to get integer value
    madd    x13, x13, x14, x9
    b       _int_convert_loop

_end_int_convert_loop:
    cmp     x15, #1
    b.ne    _return_int
    neg     x13, x13

_return_int:
    mov     x10, x13
    ret
```
In the **_str_to_int** function we store the result of the conversion in the x13 register. Which is initially set to 0. The second instruction moves 10 to the x14 register. The third instruction store moves 0 to x15 register. The x15 registers keeps track of the sign of the number ( 0 = +, 1 = -). 

Remember the x10 register holds the value we want to convert. We load the first of the integer and compare with the integer 45 which is ASCII representation of "-". If the first byte is not a negative sign we branch to the **_int_convert_loop** function, else we skip the negative sign by moving the x10 pointer one byte forward and updating the x15 register to one.

The **_int_convert_loop** function starts by loading the byte at index 1 of the x10 register into the w9 register. It the compares the value to zero, if the value is zero we are at the end and we branch to the **_end_int_convert_loop** function, else we subtract the integer from the w9 register . Subtracting 48 from the string value gives us the value as an integer. For example the ASCII representation of string "1" is 49, 49 - 48 = 1 . 

The **madd** updates the result in x13 by adding current value of x13 to constant in x14 and multiplying the result by x9 (Remember the x9 and w9 registers point to same physical memory).

The **b** instruction jumps to beginning of the function.

How the **madd** instruction does the conversion:
```math
let:
x2 = "123"
x11 = 10

ASCII value of "0" = 48

step I:
x10 = 0
w9 = x2[0] = "1" 
ASCII value of "1" = 49
x9 = w9
x9 = x9 - 48
x9 = 1

x10 = (x10 * x11) + x9 
x10 = (0 * 10) + 1 
x10 = 1

step II:
x10 = 1
w9 = x2[1] = "2"
ASCII value of "2" = 50
x9 = w9
x9 = x9 - 48
x9 = 2

x10 = (x10 * x11) + x9 
x10 = (1 * 10) + 2 
x10 = 12

step III:
x10 = 12
w9 = x3[2] = "3"
ASCII value of "3" = 51
x9 = w9
x9 = x9 - 48
x9 = 3

x10 = (x10 * x11) + x9 
x10 = (12 * 10) + 3
x10 = 123

x2 = 123
```
When the int conservation loop is done the **_end_int_convert_loop** is called. The function first compares the x15 register value with 1, if the result is negative the code branches to the **_return_int** function, else the function negates the value in the x13 register.

The **_return_int** function moves the value in the x13 register to x10 register and returns to be next instruction after **bl** instruction.

##### Arithmetic Operations

After all the commandline values have been converted to integers. The next step is to compare the operator which is stored in the w9 register. The **_compare** function compares the operators and branches to the right operation function when a match is found or calls the **_invalid_argument** function if no match is found.
```asm
_compare:  // Compare operators
    cmp     w9, #'+'
    b.eq    _addition
    cmp     w9, #'*'
    b.eq    _multiplication
    cmp     w9, #'-'
    b.eq    _subtraction
    cmp     w9, #'/'
    b.eq    _division
    b       _invalid_argument
```
The arithmetic operations themselves are straight forward, we have built in instructions for them.
```asm 
_addition:
    add     x11, x11, x12
    bl      _int_to_str
    b       _print_value

_subtraction:
    sub     x11, x11, x12
    bl      _int_to_str
    b       _print_value

_division:
    cmp     x12, #0
    b.eq    _zero_division_error
    udiv    x11, x11, x12
    bl      _int_to_str
    b       _print_value

_multiplication:
    mul     x11, x11, x12
    bl      _int_to_str
    b       _print_value
```

##### Integer to String Conversion

After getting the result of the operation, we face another problem, only string values can be printed to out the commandline. We have to have to convert the integer result to string. For this, we use the **_int_to_str** function.
```asm 
_int_to_str:
   mov     x2, #0 // character count
   mov     x13, #10 // divisor
   sub     sp, sp, #64 // Allocate memory on the stack

_check_negative:
   mov     x12, #0
   cmp     x11, #0
   b.ge    _str_convert_loop
   mov     x12, #45
   str     x12, [sp, x2]
   add     x2, x2,  #1
   neg     x11, x11

_str_convert_loop:
   udiv    x14, x11, x13
   msub    x15, x14, x13, x11 // Get remainder
   add     x15, x15, #'0' // Convert int to char
   str     x15, [sp, x2]
   add     x2, x2, #1
   mov     x11, x14
   cbnz    x11, _str_convert_loop
   mov     x14, #0
   sub     x9, x2, #1
```
Lets dive into what is going in the above code snippet. the x2 register stores an index which starts from 0. The x13 register holds a constant value 10.
In the third instruction of the **_int_to_str** function we are allocating 64bytes memory on the stack by subtracting 64 from the stack pointer. After allocating memory we move to the **_str_convert_loop**. 

We are dividing the value in the x11 register (x11 stores the result of the arithmetic operations) by the value in the w13 register and storing the result in the x14 register. We then call the **msub** instruction. Which performs the below operation.
```math
x15 = x11 - (x14 * x13)
```
The next instruction add the character '0' to value in x15 ( ASCII representation of '0' is 48, so if x15 = 1, it becomes 49. The ASCII representation of '1' is 49). We then store the value in the x15 register as bytes on the stack at index x2, x2 is then incremented by 1. The value in the x14 register is then stored in the x11 register.

The `cbnz x11, _str_convert_loop` instruction checks if the value in the x11 register is not zero. If it is not zero, it jumps to the **_str_convert_loop** label. If it is zero, it continues to the next instruction.

How the **_str_convert_loop** works.
```math
let:
w2 = 10

Step I:
x19 = 0
w0 = 123

w4 = 123 / 10
w4 = 12 // Floating point values are truncated

w5 = w0 - (w4 * w2)
w5 = 123 - (12 * 10)
w5 = 3

sp[x19] = 3

w0 = w4
x19 += 1

Step II:
x19 = 1
w0 = 12

w4 = 12 / 10
w4 = 1

w5 = w0 - (w4 * w2)
w5 = 12 - (1 * 10)
w5 = 2

sp[x19] = 2

w0 = w4
x19 += 1

Step III:
x19 = 2
w0 = 1

w4 = 1 / 10
w4 = 0

w5 = w0 - (w4 * w2)
w5 = 1 - (0 * 10)
w5 = 1

sp[x19] = 1

w0 = w4
x[19] += 1

Result:
sp = 321
```
Notice that the result is backwards. That is where the **_copy** function comes in.
```asm 
_copy:
   cmp     x12, #0
   b.eq    _n_copy
   mov     w15, #'-'
   strb    w15, [x1, x14]
   add     x14, x14, #1 // Increasing by 1 makes sure we never get to the last byte which is "-" in a negative case

_n_copy:
   ldrb    w15, [sp, x9]
   strb    w15, [x1, x14]
   add     x14, x14, #1
   sub     x9, x9, #1
   cmp     x14, x2
   b.lt    _n_copy
   add     sp, sp, #64
   ret
```
The last two instructions of the **_str_convert_loop** stores 0 in the x14 register, and stores the last index of the values stored on the stack in the x9 register.

To get the result in the right order, we load the value we stored on the stack at index x9 to the w15 register using the **ldrb** instruction and the **strb** instruction to store the value in the w15 register in the x1 register at index x14. 

As the value in the x14 register increases, the value in the x9 register decreases. When the value in x14 equals the value in x2 we exit the loop and free the memory we allocated on the stack by adding 64 bytes to the stack pointer. 

The **ret** returns to the next instruction after the "bl _int_to_str" instruction. Which is a call to the **_print_value** function.

##### Printing The Result

To print out the result of our operation. We use a syscall to write to stdout. The syscall expects a few things to be in place. The x0 register stores the return code, 0 means everything went well and any number higher than 0 means an error occurred. the x1 register stores the value to be printed out and the x2 register holds the length of the value to be printed. The x16 register holds the syscall command, 4 means print to the stdout and 1 means to exit the program. The `svc #0x80` (supervisor call) executes the syscall.

>  Syscalls send requests from our program to the operating system to do something on our behalf. Syscalls are considered private by apple and should not be used in a production application. Use the **c** standard library instead.

The **_int_to_str** function already stores the values needed in the right registers. The x2 register stores the count and the x1 registers stores the result of the conversion.
```asm 
_print_value:
    mov     x0, #0
    mov     x16, #4 // Syscall to write to stdout
    svc     #0x80 // Execute syscall

_print_newline:
    mov     x0, #0
    adr     x1, newline
    mov     x2, #1
    mov     x16, #4
    svc     #0x80

_exit:
    mov     x0, #0
    mov     x16, #1
    svc     #0x80
    
 newline:
    .ascii  "\n"
```
##### Handling Errors

There are three main errors that needs to be handled by our program. If the user inputs a floating point value, if a user tries to divide by zero and if the command line argument is not equal to 4.

In the **_division** function we check for "zero division errors" by comparing the denominator to 0. If it is we branch to the **_zero_division_error** function, which prints the the **zero_division_error_msg** and exits the program. Following the same steps we took when printing the results of our arithmetic operations.
```asm
_zero_division_error:
    adr     x1, zero_division_error_msg
    mov     x19, #20
    b       _print_value
    
zero_division_error_msg:
    .ascii "Zero Division Error"
        
```
The **_invalid_argument** function prints the **invalid_argument_error_msg** and exits the program.
```asm
_invalid_argument:
    adr     x1, error_msg
    mov     x19, #72
    b       _print_value
    
error_msg:
    .ascii  "Invalid Arguments: Example usage <program> 8 <operator = *, + , /, \\*> 7"
```

The **_no_float_support_error** function prints the **no_float_support_error_msg** and exits the program.
```asm
_no_float_support_error:
    adr     x1, no_float_support_error_msg
    mov     x19, #43
    b       _print_value
    
 no_float_support_error_msg:
     .ascii  "Floating point operations are not supported"
```
The length of the output message must be exact, because it tells the syscall when to stop reading values. A smaller length will cause the syscall to stop reading values before the end of the message, resulting in an incomplete message being displayed. A larger length will cause the syscall to read more values than necessary, resulting in garbage values being added to the message.

##### Floating Point Operations
Up to this point, our program only supports integer operations. To handle floating point operations, we need to convert the string input to floats instead of integers. This is a lot more complicated, to make our lives easier we will use the **atof** function in the **c** standard library.

Since we are stepping into the **c** world, we will also use the **printf** function in the **c** standard library to print our result instead of manually converting the integers to strings ourselves and using syscalls.

We start by refractoring the main function to use the **atof** function.
```asm 
.global _main
.align 4
.text

_main:
    stp     x29, x30, [sp, #-16]!   // Store Frame Pointer (x29) and Link Register (x30)
    mov     x29, sp

    cmp     x0, #4 // Check if the argc is equal to 4
    b.ne   _invalid_argument

    mov     x19, x1 // Stores the value of x1 in x19, incase x1 gets modified by _atof

    // First command line argument
    ldr     x0, [x19, #8]
    bl      _atof
    fmov     d11, d0

    // Third command line argument
    ldr     x0, [x19, #24]
    bl      _atof
    fmov    d12, d0

    // Second command line argument (operator)
    ldr     x10, [x19, #16]
    ldrb    w9, [x10]

```
The **.text** directive denotes the start of the text section of the program. This section contains the assembly code instructions that will be executed by the CPU.

The first instruction stores the values in the x29 and x30 registers on the stack. The next instruction stores the value of the stack pointer in the x29 register.

We have not been following the ARM64 calling convention, because we have been writing a lot of the function ourselves, external functions follow the ARM64 calling convention. One of these conventions in that the function arguments are stored in registers x0 - x8 with any additional arguments stored on the stack. The first function argument is stored in x0 and so on.

To use the **atof** function we have to store the numbers in the x0 register. The **atof** stores the return value in d0 register (d registers are used for floating point operations). we then move the result to the d11 register, the same is done for the second number with value being stored in the d12 register.

Notice the move instructions have been changed to their floating point counterparts. We change **mov** to **fmov**.

We do the same for the arithmetic operations.
```asm 
_addition:
    fadd     d11, d11, d12
    b       _print_value

_subtraction:
    fsub     d11, d11, d12
    b       _print_value

_division:
    fcmp     d12, #0.0
    b.eq    _zero_division_error
    fdiv    d11, d11, d12
    b       _print_value

_multiplication:
    fmul     d11, d11, d12
    b       _print_value
```
Lets refactor the **_print_value** function to use the **printf** function.
```asm
_print_value:
    adrp    x0, fmt_result@PAGE
    add     x0, x0, fmt_result@PAGEOFF
    str     d11, [sp]
    bl      _printf
    b       _exit

_exit:
    mov     w0, #0                  // Return code 0
    ldp     x29, x30, [sp], #16     // Restore x29 and x30
    ret
```

The **_exit** function moves 0 the w0 register and restores the values of the x29 and x30 before exiting the program

The **fmt_result** stores the format string for output. which is the first argument to the **printf** function.
```asm 
.data
fmt_result:
    .asciz  "%f\n"

fmt_str:
    .asciz  "%s\n"
```
The **.data** directive denotes the start of the data section of the program. This section contains the data that will be used by the program.

We also changed the error handling functions.
```asm 
_invalid_argument:
    // Print the error message (string) using printf("%s\n", error_msg)
    adrp    x0, fmt_str@PAGE
    add     x0, x0, fmt_str@PAGEOFF
    adr     x1, error_msg
    str     x1, [sp]
    bl      _printf
    b       _exit

_zero_division_error:
    // Print zero division error as a string
    adrp    x0, fmt_str@PAGE
    add     x0, x0, fmt_str@PAGEOFF
    adr     x1, zero_division_error_msg
    str     x1, [sp]
    bl      _printf
    b       _exit
```
We can not load the addresses of **fmt_result** and **fmt_str** variables the way we loaded the **new_line** variable because variables stored in the data section are not directly accessible. Instead, we need to use the **adrp** and **add** instructions to load the addresses of the variables into a register.

##### Conclusion

The arithmetic operations themselves where just single instructions. A lot of the work was format conversion and printing to the commandline. Working with assembly language makes you appreciate the high level abstractions that are provided by higher level languages.

Here is the link to full code on <a href="https://github.com/Builtbyjb/learn-assembly" target="_blank">github</a>. The code without float operation support is in the "no-float-point" branch

##### Learning Resources

- <a href="https://eclecticlight.co/2021/07/08/code-in-arm-assembly-moving-data-around">Moving data around</a>
- <a href="https://eclecticlight.co/2021/06/21/code-in-arm-assembly-working-with-pointers">Working with pointers</a>
- <a href="https://valsamaras.medium.com/practical-arm64-subroutines-1b5ea3935ff5">Subroutines</a>
- <a href="https://en.wikipedia.org/wiki/Calling_convention">Calling convention</a>
- <a href="https://www.0de5.net/stimuli/a-reintroduction-to-programming/instructions/assembly-essentials">Assembly essentials</a>
- <a href="https://www.asciitable.com/">ASCII table</a>
