CreateObject("WScript.Shell").Run "wscript.exe """ & CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName) & "\_run-action.vbs"" ""hit-plus""", 0, False
