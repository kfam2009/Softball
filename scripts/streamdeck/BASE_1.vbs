CreateObject("WScript.Shell").Run "wscript.exe """ & CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName) & "\_run-action.vbs"" ""base-first""", 0, False
