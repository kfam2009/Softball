Option Explicit

Dim action
If WScript.Arguments.Count < 1 Then WScript.Quit 1
action = WScript.Arguments(0)

Dim shell, fso, folder, command
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
folder = fso.GetParentFolderName(WScript.ScriptFullName)

command = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File " & _
  Chr(34) & folder & "\send-scorebug-action.ps1" & Chr(34) & " " & Chr(34) & action & Chr(34)

WScript.Quit shell.Run(command, 0, True)
