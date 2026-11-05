using System;
using System.Collections.Generic;
using System.IO;
using System.Net;

class ScorebugActionLauncher
{
    static readonly Dictionary<string, string> Actions = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
    {
        { "SCOREBUG_IN", "scorebug-in" },
        { "SCOREBUG_OUT", "scorebug-out" },
        { "AWAY_PLUS", "away-plus" },
        { "AWAY_MINUS", "away-minus" },
        { "HOME_PLUS", "home-plus" },
        { "HOME_MINUS", "home-minus" },
        { "OUT_PLUS", "out-plus" },
        { "OUT_MINUS", "out-minus" },
        { "OUTS_CLEAR", "outs-clear" },
        { "BASE_1", "base-first" },
        { "BASE_2", "base-second" },
        { "BASE_3", "base-third" },
        { "BASES_CLEAR", "bases-clear" },
        { "INNING_PLUS", "inning-plus" },
        { "INNING_MINUS", "inning-minus" },
        { "SET_PLUS", "set-plus" },
        { "SET_MINUS", "set-minus" },
        { "HALF_TOGGLE", "half-toggle" }
    };

    static int Main(string[] args)
    {
        string key = args.Length > 0 ? args[0] : Path.GetFileNameWithoutExtension(Environment.GetCommandLineArgs()[0]);
        string action;

        if (!Actions.TryGetValue(key, out action))
            return 2;

        string url = "http://localhost:8136/api/scorebug/" + action;

        try
        {
            var request = (HttpWebRequest)WebRequest.Create(url);
            request.Method = "POST";
            request.Timeout = 2000;
            request.ContentLength = 0;

            using (var response = (HttpWebResponse)request.GetResponse())
            {
                return (int)response.StatusCode >= 200 && (int)response.StatusCode < 300 ? 0 : 1;
            }
        }
        catch
        {
            return 1;
        }
    }
}
