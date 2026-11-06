CreateObject("WScript.Shell").Run "wscript.exe """ & CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName) & "\_run-action.vbs"" ""ad-in""", 0, False
